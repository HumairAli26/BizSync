import { auth, db } from "@/config/firebaseConfig";
import { Spacing } from "@/constants/theme";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { styled } from "nativewind";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

const Settings = () => {
  const [userName, setUserName] = useState<string>("");
  const [orgName, setOrgName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [orgCode, setOrgCode] = useState<string>("");
  const [orgId, setOrgId] = useState<string>("");
  const [role, setRole] = useState<string>("member");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Edit name modal
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  // Change password modal
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Load current user doc
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsubscribe = onSnapshot(doc(db, "users", uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setOrgName(data.orgName);
        setUserName(data.name);
        setUserEmail(data.email);
        setOrgCode(data.orgCode);
        setOrgId(data.orgId);
        setRole(data.role);
      }
    });

    return unsubscribe;
  }, []);

  // Load team members once we know the orgId
  useEffect(() => {
    if (!orgId) return;

    const q = query(collection(db, "users"), where("orgId", "==", orgId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const members = snapshot.docs.map((d) => ({
        id: d.id,
        name: d.data().name,
        email: d.data().email,
        role: d.data().role,
      }));
      setTeamMembers(members);
    });

    return unsubscribe;
  }, [orgId]);

  const handleCopyOrgCode = async () => {
    await Clipboard.setStringAsync(orgCode);
    Alert.alert("Copied", "Organization code copied to clipboard.");
  };

  const handleSaveName = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !nameDraft.trim()) return;

    try {
      await updateDoc(doc(db, "users", uid), { name: nameDraft.trim() });
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: nameDraft.trim(),
        });
      }
      setEditNameVisible(false);
    } catch (err: any) {
      Alert.alert("Update failed", err.message);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert("Missing fields", "Please fill in both fields.");
      return;
    }
    const user = auth.currentUser;
    if (!user || !user.email) return;

    try {
      // Re-authenticate first — Firebase requires a recent login for sensitive actions
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword,
      );
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setPasswordModalVisible(false);
      setCurrentPassword("");
      setNewPassword("");
      Alert.alert("Success", "Password updated.");
    } catch (err: any) {
      Alert.alert("Password change failed", err.message);
    }
  };

  const handleLogOut = async () => {
    try {
      await signOut(auth);
      router.replace("/(auth)");
    } catch (err: any) {
      console.error("Sign out failed:", err.message);
    }
  };

  const handleLeaveOrDelete = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account. This cannot be undone. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const uid = auth.currentUser?.uid;
            if (!uid || !auth.currentUser) return;
            try {
              await deleteDoc(doc(db, "users", uid));
              await deleteUser(auth.currentUser);
              router.replace("/(auth)");
            } catch (err: any) {
              Alert.alert(
                "Delete failed",
                err.message +
                  " — you may need to log out and back in first, then retry.",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background p-5">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 10 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{ fontSize: Spacing[4] }}
          className="text-text font-inter-bold"
        >
          Settings
        </Text>

        {/* Organization */}
        <View className="mb-4">
          <Text
            style={{ fontSize: Spacing[4] }}
            className="mt-5 font-inter-bold text-text"
          >
            Your Organization
          </Text>
          <View className="home-balance-card mb-2">
            <Text className="text-text">{orgName}</Text>
          </View>

          {role === "admin" && (
            <View className="home-balance-card mb-4 flex-row justify-between items-center">
              <View>
                <Text className="text-text-muted" style={{ fontSize: 12 }}>
                  Organization Code
                </Text>
                <Text className="text-text font-inter-bold">{orgCode}</Text>
              </View>
              <TouchableOpacity
                onPress={handleCopyOrgCode}
                style={{
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
                className="bg-primary"
              >
                <Text
                  className="text-text font-inter-bold"
                  style={{ fontSize: 12 }}
                >
                  Copy
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Profile */}
        <View className="mt-2">
          <Text
            style={{ fontSize: Spacing[4] }}
            className="mt-3 font-inter-bold text-text"
          >
            User Name
          </Text>
          <TouchableOpacity
            className="home-balance-card mb-4 flex-row justify-between items-center"
            onPress={() => {
              setNameDraft(userName);
              setEditNameVisible(true);
            }}
          >
            <Text className="text-text">{userName}</Text>
            <Text className="text-text-muted" style={{ fontSize: 12 }}>
              Edit
            </Text>
          </TouchableOpacity>

          <Text
            style={{ fontSize: Spacing[4] }}
            className="mt-3 font-inter-bold text-text"
          >
            Email
          </Text>
          <View className="home-balance-card mb-4">
            <Text className="text-text">{userEmail}</Text>
          </View>

          <TouchableOpacity
            className="home-balance-card mb-4"
            onPress={() => setPasswordModalVisible(true)}
          >
            <Text className="text-text">Change Password</Text>
          </TouchableOpacity>
        </View>

        {/* Team members */}
        <View className="mt-2">
          <Text
            style={{ fontSize: Spacing[4] }}
            className="mt-3 font-inter-bold text-text"
          >
            Team ({teamMembers.length})
          </Text>
          {teamMembers.map((member) => (
            <View
              key={member.id}
              className="home-balance-card mb-2 flex-row justify-between items-center"
            >
              <View>
                <Text className="text-text">{member.name}</Text>
                <Text className="text-text-muted" style={{ fontSize: 12 }}>
                  {member.email}
                </Text>
              </View>
              <Text className="text-text-muted" style={{ fontSize: 12 }}>
                {member.role}
              </Text>
            </View>
          ))}
        </View>

        {/* Support / About */}
        <View className="mt-5">
          <TouchableOpacity
            className="home-balance-card mb-2"
            onPress={() =>
              Alert.alert("Support", "Contact us at support@bizsync.app")
            }
          >
            <Text className="text-text">Contact Support</Text>
          </TouchableOpacity>
          <View className="home-balance-card mb-4">
            <Text className="text-text-muted" style={{ fontSize: 12 }}>
              BizSync v1.0.0
            </Text>
          </View>
        </View>

        {/* Danger zone */}
        <View className="flex-row gap-38 mb-5">
          <View className="mt-2 mb-6">
            <TouchableOpacity onPress={handleLeaveOrDelete} className="mb-3">
              <Text className="text-red-600 text-center font-inter-bold">
                Delete Account
              </Text>
            </TouchableOpacity>
          </View>

          <View className="items-center justify-center mb-10">
            <TouchableOpacity
              onPress={handleLogOut}
              style={{ borderRadius: 12, height: 40, paddingHorizontal: 25 }}
              className="items-center justify-center bg-primary p-2"
            >
              <Text
                style={{ fontSize: Spacing[4] }}
                className="text-text font-inter-extrabold"
              >
                Log Out
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal visible={editNameVisible} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: "#1a1a1a",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <Text
              className="text-text font-inter-bold"
              style={{ fontSize: 16, marginBottom: 12 }}
            >
              Edit Name
            </Text>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Your name"
              placeholderTextColor="#666"
              style={{
                borderWidth: 1,
                borderColor: "#333",
                borderRadius: 10,
                padding: 12,
                color: "#fff",
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setEditNameVisible(false)}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: "#333",
                  borderRadius: 10,
                  padding: 12,
                  alignItems: "center",
                }}
              >
                <Text className="text-text">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveName}
                style={{
                  flex: 1,
                  backgroundColor: "#5B6F3A",
                  borderRadius: 10,
                  padding: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={passwordModalVisible} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: "#1a1a1a",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <Text
              className="text-text font-inter-bold"
              style={{ fontSize: 16, marginBottom: 12 }}
            >
              Change Password
            </Text>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              placeholderTextColor="#666"
              secureTextEntry
              style={{
                borderWidth: 1,
                borderColor: "#333",
                borderRadius: 10,
                padding: 12,
                color: "#fff",
                marginBottom: 10,
              }}
            />
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password"
              placeholderTextColor="#666"
              secureTextEntry
              style={{
                borderWidth: 1,
                borderColor: "#333",
                borderRadius: 10,
                padding: 12,
                color: "#fff",
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setPasswordModalVisible(false)}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: "#333",
                  borderRadius: 10,
                  padding: 12,
                  alignItems: "center",
                }}
              >
                <Text className="text-text">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleChangePassword}
                style={{
                  flex: 1,
                  backgroundColor: "#5B6F3A",
                  borderRadius: 10,
                  padding: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Settings;
