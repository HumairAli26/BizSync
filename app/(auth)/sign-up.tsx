import { auth, db } from "@/config/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, doc, setDoc } from "firebase/firestore";
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

export default function SignUpScreen() {
  const [name, setName] = useState<string>("");
  const [orgName, setOrgName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSignUp = async (): Promise<void> => {
    if (!name || !orgName || !email || !password) {
      Alert.alert("Missing fields", "Please fill in everything.");
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      const orgCode = generateOrgCode();

      const orgRef = doc(collection(db, "organizations"));
      await setDoc(orgRef, {
        name: orgName,
        code: orgCode,
        createdBy: cred.user.uid,
      });

      await setDoc(doc(db, "users", cred.user.uid), {
        name,
        email: email.trim(),
        orgId: orgRef.id,
        orgName,
        orgCode,
        role: "admin",
      });

      Alert.alert(
        "Account created",
        `Your organization code is: ${orgCode}\nShare this with teammates so they can sign in.`,
        [{ text: "OK", onPress: () => router.replace("/(tabs)") }],
      );
    } catch (err: any) {
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
      <Text style={styles.subtitle}>Set up your BizSync organization</Text>

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
          {loading ? "Creating..." : "Sign Up"}
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
  subtitle: { color: "#999", fontSize: 14, marginBottom: 24 },
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
