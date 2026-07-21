import { auth, db } from "@/config/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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

export default function SignInScreen() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [orgCode, setOrgCode] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSignIn = async (): Promise<void> => {
    if (!email || !password || !orgCode) {
      Alert.alert("Missing fields", "Please fill in everything.");
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      const userSnap = await getDoc(doc(db, "users", cred.user.uid));
      const userData = userSnap.data() as
        { orgCode?: string; orgName?: string } | undefined;

      if (
        !userSnap.exists() ||
        userData?.orgCode !== orgCode.trim().toUpperCase()
      ) {
        await signOut(auth);
        Alert.alert("Sign in failed", "Invalid organization code.");
        return;
      }

      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Sign in failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in to your BizSync account</Text>
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
          placeholder="admin@bizsync.com"
          placeholderTextColor="#666"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      </View>
      <View style={styles.rowBetween}>
        <Text style={styles.label}>Password</Text>
        <TouchableOpacity>
          <Text style={styles.forgot}>Forgot?</Text>
        </TouchableOpacity>
      </View>
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
          value={orgCode}
          onChangeText={setOrgCode}
        />
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={handleSignIn}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Signing in..." : "Sign In"}
        </Text>
      </TouchableOpacity>
      /*<Text style={styles.orText}>or continue with</Text>
      <View style={styles.socialRow}>
        <TouchableOpacity style={styles.socialBtn}>
          <Text style={styles.socialText}>Google</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.socialBtn}>
          <Text style={styles.socialText}>Apple</Text>
        </TouchableOpacity>
      </View>
      */
      <TouchableOpacity onPress={() => router.push("/(auth)/sign-up")}>
        <Text style={styles.footerText}>
          Don't have an account? <Text style={styles.link}>Create one</Text>
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
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 6,
    marginTop: 40,
  },
  subtitle: { color: "#999", fontSize: 14, marginBottom: 24 },
  label: { color: "#ccc", fontSize: 13, marginBottom: 6, marginTop: 12 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  forgot: { color: "#fff", fontSize: 13, fontWeight: "600" },
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
  orText: {
    color: "#777",
    textAlign: "center",
    marginTop: 24,
    marginBottom: 14,
    fontSize: 12,
  },
  socialRow: { flexDirection: "row", gap: 12 },
  socialBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  socialText: { color: "#fff", fontWeight: "500" },
  footerText: {
    color: "#999",
    textAlign: "center",
    marginTop: 20,
    fontSize: 13,
  },
  link: { color: "#fff", fontWeight: "600" },
});
