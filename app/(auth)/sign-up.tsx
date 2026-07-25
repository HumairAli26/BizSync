import { auth, db } from "@/config/firebaseConfig";
import {
  sanitizeEmail,
  sanitizeOrgCode,
  validateGoogleEmail,
  validateOrgCode,
  validatePassword,
  validateRequiredText,
} from "@/lib/validation";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { collection, doc, getDoc, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

function generateOrgCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Firestore rules deliberately do NOT allow listing/querying the
// `organizations` collection (that would let anyone enumerate every org).
// So "find the org for this code" can't be a `where("code", "==", ...)`
// query — that's a list operation and would be denied.
//
// Instead, `orgCodes/{code}` is a tiny lookup collection where the CODE
// ITSELF is the document ID. Reading a document by an ID you already have
// is a `get`, not a `list`, so it can be allowed broadly without exposing
// the rest of the org directory. This needs no Cloud Function — it's a
// second small write at signup time, done entirely from the client.
async function createOrgWithUniqueCode(
  orgName: string,
  createdBy: string,
): Promise<{ orgId: string; orgCode: string }> {
  const orgRef = doc(collection(db, "organizations"));

  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const orgCode = generateOrgCode();

    try {
      // Written first: if this exact code already belongs to another org,
      // Firestore evaluates this as an UPDATE (since the doc already
      // exists), which the rules deny — so a collision fails loudly here
      // instead of silently overwriting someone else's mapping.
      await setDoc(doc(db, "orgCodes", orgCode), { orgId: orgRef.id });

      await setDoc(orgRef, {
        name: orgName,
        code: orgCode,
        createdBy,
      });

      return { orgId: orgRef.id, orgCode };
    } catch (err) {
      // Collision on this specific code — try again with a new one.
      if (attempt === MAX_ATTEMPTS - 1) throw err;
    }
  }

  throw new Error("Could not generate a unique organization code.");
}

type Mode = "create" | "join";

export default function SignUpScreen() {
  const [mode, setMode] = useState<Mode>("create");

  const [name, setName] = useState<string>("");
  const [orgName, setOrgName] = useState<string>("");
  const [joinOrgCode, setJoinOrgCode] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSignUp = async (): Promise<void> => {
    const normalizedEmail = sanitizeEmail(email);
    const normalizedJoinCode = sanitizeOrgCode(joinOrgCode);

    // Shared field validation
    if (
      !validateRequiredText(name) ||
      !normalizedEmail ||
      !password ||
      (mode === "create" && !validateRequiredText(orgName)) ||
      (mode === "join" && !normalizedJoinCode)
    ) {
      Alert.alert("Missing fields", "Please fill in everything.");
      return;
    }
    if (!validateGoogleEmail(normalizedEmail)) {
      Alert.alert(
        "Invalid email",
        "Enter a valid Google email address such as name@gmail.com.",
      );
      return;
    }
    if (!validatePassword(password)) {
      Alert.alert(
        "Weak password",
        "Password must be at least 8 characters and include both letters and numbers.",
      );
      return;
    }
    if (mode === "join" && !validateOrgCode(normalizedJoinCode)) {
      Alert.alert(
        "Invalid code",
        "Organization code must be 6 letters/numbers.",
      );
      return;
    }

    setLoading(true);

    let createdUser = null;

    try {
      if (mode === "join") {
        // Resolve the code to an orgId via the lookup collection BEFORE
        // creating the Auth account — if the code doesn't exist, we can
        // bail out without ever creating (and having to roll back) a user.
        const codeSnap = await getDoc(doc(db, "orgCodes", normalizedJoinCode));

        if (!codeSnap.exists()) {
          Alert.alert(
            "Not found",
            "No organization matches that code. Check with your admin and try again.",
          );
          setLoading(false);
          return;
        }

        const { orgId } = codeSnap.data() as { orgId: string };
        const orgSnap = await getDoc(doc(db, "organizations", orgId));
        const orgData = orgSnap.data() as { name?: string; code?: string };

        const cred = await createUserWithEmailAndPassword(
          auth,
          normalizedEmail,
          password,
        );
        createdUser = cred.user;

        await setDoc(doc(db, "users", cred.user.uid), {
          name,
          email: normalizedEmail,
          orgId,
          orgName: orgData.name ?? "",
          orgCode: orgData.code ?? normalizedJoinCode,
          role: "member",
        });

        Alert.alert(
          "Account created",
          `You've joined ${orgData.name ?? "the organization"}.`,
          [{ text: "OK", onPress: () => router.replace("/(tabs)") }],
        );
      } else {
        const cred = await createUserWithEmailAndPassword(
          auth,
          normalizedEmail,
          password,
        );
        createdUser = cred.user;

        const { orgId, orgCode } = await createOrgWithUniqueCode(
          orgName,
          cred.user.uid,
        );

        await setDoc(doc(db, "users", cred.user.uid), {
          name,
          email: normalizedEmail,
          orgId,
          orgName,
          orgCode,
          role: "admin",
        });

        Alert.alert(
          "Account created",
          `Your organization code is: ${orgCode}\nShare this with teammates so they can sign in.`,
          [{ text: "OK", onPress: () => router.replace("/(tabs)") }],
        );
      }
    } catch (err: any) {
      // If Auth succeeded but Firestore writes failed, roll back the Auth account
      // so the user isn't left in a broken "email already in use" state.
      if (createdUser) {
        try {
          await deleteUser(createdUser);
        } catch (cleanupErr) {
          console.error("Failed to roll back orphaned auth user:", cleanupErr);
        }
      }
      Alert.alert("Sign up failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.title}>Create account</Text>
      <Text style={styles.subtitle}>Set up or join a BizSync organization</Text>

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "create" && styles.modeBtnActive]}
          onPress={() => setMode("create")}
        >
          <Text
            style={[
              styles.modeBtnText,
              mode === "create" && styles.modeBtnTextActive,
            ]}
          >
            Create organization
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "join" && styles.modeBtnActive]}
          onPress={() => setMode("join")}
        >
          <Text
            style={[
              styles.modeBtnText,
              mode === "join" && styles.modeBtnTextActive,
            ]}
          >
            Join organization
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Full name</Text>
      <View style={styles.inputWrap}>
        <Ionicons
          name="person-outline"
          size={18}
          color="#888"
          style={styles.icon}
        />
        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor="#666"
          value={name}
          onChangeText={setName}
        />
      </View>

      {mode === "create" ? (
        <>
          <Text style={styles.label}>Organization name</Text>
          <View style={styles.inputWrap}>
            <Ionicons
              name="business-outline"
              size={18}
              color="#888"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              placeholder="e.g. Acme Inc."
              placeholderTextColor="#666"
              value={orgName}
              onChangeText={setOrgName}
            />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.label}>Organization code</Text>
          <View style={styles.inputWrap}>
            <Ionicons
              name="key-outline"
              size={18}
              color="#888"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              placeholder="e.g. A7F3K9"
              placeholderTextColor="#666"
              autoCapitalize="characters"
              autoCorrect={false}
              value={joinOrgCode}
              onChangeText={(value) =>
                setJoinOrgCode(value.replace(/\s+/g, ""))
              }
            />
          </View>
        </>
      )}

      <Text style={styles.label}>Email address</Text>
      <View style={styles.inputWrap}>
        <Ionicons
          name="mail-outline"
          size={18}
          color="#888"
          style={styles.icon}
        />
        <TextInput
          style={styles.input}
          placeholder="you@company.com"
          placeholderTextColor="#666"
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />
      </View>

      <Text style={styles.label}>Password</Text>
      <View style={styles.inputWrap}>
        <Ionicons
          name="lock-closed-outline"
          size={18}
          color="#888"
          style={styles.icon}
        />
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#666"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Ionicons
            name={showPassword ? "eye-off-outline" : "eye-outline"}
            size={18}
            color="#888"
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handleSignUp}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading
            ? "Creating..."
            : mode === "join"
              ? "Join Organization"
              : "Sign Up"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(auth)/sign-in")}>
        <Text style={styles.footerText}>
          Already have an account? <Text style={styles.link}>Sign in</Text>
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d0d",
    padding: 24,
    paddingTop: 60,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: { color: "#fff", fontSize: 28, fontWeight: "bold", marginBottom: 6 },
  subtitle: { color: "#999", fontSize: 14, marginBottom: 20 },
  modeRow: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: "center",
  },
  modeBtnActive: {
    backgroundColor: "#5B6F3A",
  },
  modeBtnText: {
    color: "#999",
    fontSize: 13,
    fontWeight: "600",
  },
  modeBtnTextActive: {
    color: "#fff",
  },
  label: { color: "#ccc", fontSize: 13, marginBottom: 6, marginTop: 12 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, color: "#fff", fontSize: 15 },
  button: {
    backgroundColor: "#5B6F3A",
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  footerText: {
    color: "#999",
    textAlign: "center",
    marginTop: 20,
    fontSize: 13,
  },
  link: { color: "#fff", fontWeight: "600" },
});
