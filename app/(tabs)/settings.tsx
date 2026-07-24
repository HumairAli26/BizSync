import { auth, db } from "@/config/firebaseConfig";
import { Spacing } from "@/constants/theme";
import { validatePassword, validateRequiredText } from "@/lib/validation";
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

  // These feed directly into the invoice PDF header (generateInvoicePdf.ts)
  // — all optional there, and simply omitted from the invoice if blank.
  const [orgAddress, setOrgAddress] = useState<string>("");
  const [orgPhone, setOrgPhone] = useState<string>("");
  const [orgCell, setOrgCell] = useState<string>("");
  const [orgNtn, setOrgNtn] = useState<string>("");
  const [orgSalesTaxNo, setOrgSalesTaxNo] = useState<string>("");

  // Edit name modal
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  // Edit org details modal (address, phone, cell, NTN, sales tax no)
  const [editOrgDetailsVisible, setEditOrgDetailsVisible] = useState(false);
  const [orgAddressDraft, setOrgAddressDraft] = useState("");
  const [orgPhoneDraft, setOrgPhoneDraft] = useState("");
  const [orgCellDraft, setOrgCellDraft] = useState("");
  const [orgNtnDraft, setOrgNtnDraft] = useState("");
  const [orgSalesTaxNoDraft, setOrgSalesTaxNoDraft] = useState("");
  const [savingOrgDetails, setSavingOrgDetails] = useState(false);

  // Change password modal
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Delete account modal
  const [deleteAccountVisible, setDeleteAccountVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

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
        setOrgAddress(data.orgAddress ?? "");
        setOrgPhone(data.orgPhone ?? "");
        setOrgCell(data.orgCell ?? "");
        setOrgNtn(data.orgNtn ?? "");
        setOrgSalesTaxNo(data.orgSalesTaxNo ?? "");
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
    if (!uid || !validateRequiredText(nameDraft)) {
      Alert.alert("Missing info", "Please enter a valid name.");
      return;
    }

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

  const openEditOrgDetails = () => {
    setOrgAddressDraft(orgAddress);
    setOrgPhoneDraft(orgPhone);
    setOrgCellDraft(orgCell);
    setOrgNtnDraft(orgNtn);
    setOrgSalesTaxNoDraft(orgSalesTaxNo);
    setEditOrgDetailsVisible(true);
  };

  const handleSaveOrgDetails = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const phone = orgPhoneDraft.trim();
    if (phone && !/^[+\d][\d\s-]{7,}$/.test(phone)) {
      Alert.alert("Invalid phone", "Enter a valid business phone number.");
      return;
    }

    const cell = orgCellDraft.trim();
    if (cell && !/^[+\d][\d\s-]{7,}$/.test(cell)) {
      Alert.alert("Invalid cell number", "Enter a valid business cell number.");
      return;
    }

    setSavingOrgDetails(true);
    try {
      await updateDoc(doc(db, "users", uid), {
        orgAddress: orgAddressDraft.trim(),
        orgPhone: orgPhoneDraft.trim(),
        orgCell: orgCellDraft.trim(),
        orgNtn: orgNtnDraft.trim(),
        orgSalesTaxNo: orgSalesTaxNoDraft.trim(),
      });
      setEditOrgDetailsVisible(false);
    } catch (err: any) {
      Alert.alert("Update failed", err.message);
    } finally {
      setSavingOrgDetails(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert("Missing fields", "Please fill in both fields.");
      return;
    }
    if (!validatePassword(newPassword)) {
      Alert.alert(
        "Weak password",
        "New password must be at least 8 characters and include letters and numbers.",
      );
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

  const handleDeleteAccount = async () => {
    const user = auth.currentUser;
    const uid = user?.uid;

    if (!user || !uid || !user.email) return;
    if (!deletePassword.trim()) {
      Alert.alert(
        "Missing password",
        "Enter your current password to continue.",
      );
      return;
    }

    setDeletingAccount(true);
    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        deletePassword,
      );
      await reauthenticateWithCredential(user, credential);
      await deleteUser(user);
      await deleteDoc(doc(db, "users", uid));

      setDeleteAccountVisible(false);
      setDeletePassword("");
      router.replace("/(auth)");
    } catch (err: any) {
      Alert.alert(
        "Delete failed",
        err.message + " — make sure your password is correct, then retry.",
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const isAdmin = role === "admin";

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
        <View className="mb-6">
          <Text
            style={{ fontSize: Spacing[4], marginBottom: 4 }}
            className="mt-6 font-inter-bold text-text"
          >
            Your Organization
          </Text>
          <View
            className="home-balance-card mb-3"
            style={{ paddingVertical: 16, paddingHorizontal: 16 }}
          >
            <Text className="text-text">{orgName}</Text>
          </View>

          {role === "admin" && (
            <View
              className="home-balance-card mb-5 flex-row justify-between items-center"
              style={{ paddingVertical: 16, paddingHorizontal: 16 }}
            >
              <View>
                <Text className="text-text-muted" style={{ fontSize: 12 }}>
                  Organization Code
                </Text>
                <Text
                  className="text-text font-inter-bold"
                  style={{ marginTop: 4 }}
                >
                  {orgCode}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCopyOrgCode}
                style={{
                  borderRadius: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
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

          {/*
            Address / phone / cell / NTN / sales tax no. shown here purely
            for invoice branding (generateInvoicePdf.ts prints these right
            under the org name, and simply skips whichever ones are blank —
            they're never shown as empty placeholders on the invoice itself).
            Only admins can edit — everyone else sees them read-only, and
            the row is hidden entirely for non-admins if nothing has been
            entered yet.
          */}
          {isAdmin ? (
            <TouchableOpacity
              className="home-balance-card mb-3"
              style={{ paddingVertical: 16, paddingHorizontal: 16 }}
              onPress={openEditOrgDetails}
            >
              <View className="flex-row justify-between items-center">
                <Text className="text-text-muted" style={{ fontSize: 12 }}>
                  Invoice Details
                </Text>
                <Text className="text-text-muted" style={{ fontSize: 12 }}>
                  Edit
                </Text>
              </View>
              <Text
                className="text-text"
                style={{ marginTop: 8 }}
                numberOfLines={1}
              >
                {orgAddress || "Add your business address"}
              </Text>
              {orgPhone ? (
                <Text
                  className="text-text"
                  style={{ marginTop: 4 }}
                  numberOfLines={1}
                >
                  Phone: {orgPhone}
                </Text>
              ) : null}
              {orgCell ? (
                <Text
                  className="text-text"
                  style={{ marginTop: 4 }}
                  numberOfLines={1}
                >
                  Cell: {orgCell}
                </Text>
              ) : null}
              {orgNtn ? (
                <Text
                  className="text-text"
                  style={{ marginTop: 4 }}
                  numberOfLines={1}
                >
                  NTN: {orgNtn}
                </Text>
              ) : null}
              {orgSalesTaxNo ? (
                <Text
                  className="text-text"
                  style={{ marginTop: 4 }}
                  numberOfLines={1}
                >
                  Sales Tax No: {orgSalesTaxNo}
                </Text>
              ) : null}
              {!orgPhone && !orgCell && !orgNtn && !orgSalesTaxNo ? (
                <Text
                  className="text-text-muted"
                  style={{ marginTop: 4, fontSize: 12 }}
                >
                  Add phone, cell, NTN & sales tax no.
                </Text>
              ) : null}
            </TouchableOpacity>
          ) : (
            (orgAddress || orgPhone || orgCell || orgNtn || orgSalesTaxNo) && (
              <View
                className="home-balance-card mb-3"
                style={{ paddingVertical: 16, paddingHorizontal: 16 }}
              >
                <Text className="text-text-muted" style={{ fontSize: 12 }}>
                  Invoice Details
                </Text>
                {orgAddress ? (
                  <Text className="text-text" style={{ marginTop: 8 }}>
                    {orgAddress}
                  </Text>
                ) : null}
                {orgPhone ? (
                  <Text className="text-text" style={{ marginTop: 4 }}>
                    Phone: {orgPhone}
                  </Text>
                ) : null}
                {orgCell ? (
                  <Text className="text-text" style={{ marginTop: 4 }}>
                    Cell: {orgCell}
                  </Text>
                ) : null}
                {orgNtn ? (
                  <Text className="text-text" style={{ marginTop: 4 }}>
                    NTN: {orgNtn}
                  </Text>
                ) : null}
                {orgSalesTaxNo ? (
                  <Text className="text-text" style={{ marginTop: 4 }}>
                    Sales Tax No: {orgSalesTaxNo}
                  </Text>
                ) : null}
              </View>
            )
          )}
        </View>

        {/* Profile */}
        <View className="mt-3">
          <Text
            style={{ fontSize: Spacing[4], marginBottom: 4 }}
            className="mt-4 font-inter-bold text-text"
          >
            User Name
          </Text>
          <TouchableOpacity
            className="home-balance-card mb-5 flex-row justify-between items-center"
            style={{ paddingVertical: 16, paddingHorizontal: 16 }}
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
            style={{ fontSize: Spacing[4], marginBottom: 4 }}
            className="mt-4 font-inter-bold text-text"
          >
            Email
          </Text>
          <View
            className="home-balance-card mb-5"
            style={{ paddingVertical: 16, paddingHorizontal: 16 }}
          >
            <Text className="text-text">{userEmail}</Text>
          </View>

          <TouchableOpacity
            className="home-balance-card mb-5"
            style={{ paddingVertical: 16, paddingHorizontal: 16 }}
            onPress={() => setPasswordModalVisible(true)}
          >
            <Text className="text-text">Change Password</Text>
          </TouchableOpacity>
        </View>

        {/* Team members */}
        <View className="mt-3">
          <Text
            style={{ fontSize: Spacing[4], marginBottom: 4 }}
            className="mt-4 font-inter-bold text-text"
          >
            Team ({teamMembers.length})
          </Text>
          {teamMembers.map((member) => (
            <View
              key={member.id}
              className="home-balance-card mb-3 flex-row justify-between items-center"
              style={{ paddingVertical: 14, paddingHorizontal: 16 }}
            >
              <View>
                <Text className="text-text">{member.name}</Text>
                <Text
                  className="text-text-muted"
                  style={{ fontSize: 12, marginTop: 2 }}
                >
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
        <View className="mt-6">
          <TouchableOpacity
            className="home-balance-card mb-3"
            style={{ paddingVertical: 16, paddingHorizontal: 16 }}
            onPress={() =>
              Alert.alert("Support", "Contact us at support@bizsync.app")
            }
          >
            <Text className="text-text">Contact Support</Text>
          </TouchableOpacity>
          <View
            className="home-balance-card mb-5"
            style={{ paddingVertical: 16, paddingHorizontal: 16 }}
          >
            <Text className="text-text-muted" style={{ fontSize: 12 }}>
              BizSync v1.0.0
            </Text>
          </View>
        </View>

        {/* Danger zone */}
        <View className="mb-8 gap-3">
          <TouchableOpacity
            onPress={() => setDeleteAccountVisible(true)}
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "rgba(239,68,68,0.35)",
              backgroundColor: "rgba(239,68,68,0.12)",
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            <Text className="text-red-500 text-center font-inter-bold">
              Delete Account
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogOut}
            style={{
              borderRadius: 14,
              height: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
            className="bg-primary"
          >
            <Text
              style={{ fontSize: Spacing[4] }}
              className="text-text font-inter-extrabold"
            >
              Log Out
            </Text>
          </TouchableOpacity>
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
              autoCorrect={false}
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

      {/* Edit Org Details Modal (address, phone, cell, NTN, sales tax no) */}
      <Modal visible={editOrgDetailsVisible} transparent animationType="fade">
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
              padding: 22,
              maxHeight: "85%",
            }}
          >
            <Text
              className="text-text font-inter-bold"
              style={{ fontSize: 16, marginBottom: 6 }}
            >
              Invoice Details
            </Text>
            <Text
              className="text-text-muted"
              style={{ fontSize: 12, marginBottom: 18 }}
            >
              Shown on your invoice PDFs, right below your organization name.
              All fields are optional — leave any blank to omit it from
              invoices.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text
                className="text-text-muted"
                style={{ fontSize: 11, marginBottom: 6 }}
              >
                Business Address
              </Text>
              <TextInput
                value={orgAddressDraft}
                onChangeText={setOrgAddressDraft}
                placeholder="Business address"
                placeholderTextColor="#666"
                multiline
                autoCorrect={false}
                style={{
                  borderWidth: 1,
                  borderColor: "#333",
                  borderRadius: 10,
                  padding: 14,
                  color: "#fff",
                  marginBottom: 16,
                  minHeight: 54,
                  textAlignVertical: "top",
                }}
              />

              <Text
                className="text-text-muted"
                style={{ fontSize: 11, marginBottom: 6 }}
              >
                Phone No
              </Text>
              <TextInput
                value={orgPhoneDraft}
                onChangeText={setOrgPhoneDraft}
                placeholder="Business phone number"
                placeholderTextColor="#666"
                keyboardType="phone-pad"
                autoCorrect={false}
                style={{
                  borderWidth: 1,
                  borderColor: "#333",
                  borderRadius: 10,
                  padding: 14,
                  color: "#fff",
                  marginBottom: 16,
                }}
              />

              <Text
                className="text-text-muted"
                style={{ fontSize: 11, marginBottom: 6 }}
              >
                Cell No
              </Text>
              <TextInput
                value={orgCellDraft}
                onChangeText={setOrgCellDraft}
                placeholder="Business cell number"
                placeholderTextColor="#666"
                keyboardType="phone-pad"
                autoCorrect={false}
                style={{
                  borderWidth: 1,
                  borderColor: "#333",
                  borderRadius: 10,
                  padding: 14,
                  color: "#fff",
                  marginBottom: 16,
                }}
              />

              <Text
                className="text-text-muted"
                style={{ fontSize: 11, marginBottom: 6 }}
              >
                NTN No
              </Text>
              <TextInput
                value={orgNtnDraft}
                onChangeText={setOrgNtnDraft}
                placeholder="National Tax Number"
                placeholderTextColor="#666"
                autoCorrect={false}
                autoCapitalize="characters"
                style={{
                  borderWidth: 1,
                  borderColor: "#333",
                  borderRadius: 10,
                  padding: 14,
                  color: "#fff",
                  marginBottom: 16,
                }}
              />

              <Text
                className="text-text-muted"
                style={{ fontSize: 11, marginBottom: 6 }}
              >
                Sales Tax No
              </Text>
              <TextInput
                value={orgSalesTaxNoDraft}
                onChangeText={setOrgSalesTaxNoDraft}
                placeholder="Sales Tax Registration Number"
                placeholderTextColor="#666"
                autoCorrect={false}
                autoCapitalize="characters"
                style={{
                  borderWidth: 1,
                  borderColor: "#333",
                  borderRadius: 10,
                  padding: 14,
                  color: "#fff",
                  marginBottom: 20,
                }}
              />
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                onPress={() => setEditOrgDetailsVisible(false)}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: "#333",
                  borderRadius: 10,
                  padding: 14,
                  alignItems: "center",
                }}
              >
                <Text className="text-text">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={savingOrgDetails}
                onPress={handleSaveOrgDetails}
                style={{
                  flex: 1,
                  backgroundColor: "#5B6F3A",
                  borderRadius: 10,
                  padding: 14,
                  alignItems: "center",
                  opacity: savingOrgDetails ? 0.6 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>
                  {savingOrgDetails ? "Saving..." : "Save"}
                </Text>
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
              autoCapitalize="none"
              autoCorrect={false}
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
              autoCapitalize="none"
              autoCorrect={false}
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

      {/* Delete Account Modal */}
      <Modal visible={deleteAccountVisible} transparent animationType="fade">
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
              style={{ fontSize: 16, marginBottom: 8 }}
            >
              Delete Account
            </Text>
            <Text
              className="text-text-muted"
              style={{ fontSize: 12, marginBottom: 14 }}
            >
              Enter your current password to permanently delete your account.
            </Text>
            <TextInput
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Current password"
              placeholderTextColor="#666"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
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
                onPress={() => {
                  setDeleteAccountVisible(false);
                  setDeletePassword("");
                }}
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
                disabled={deletingAccount}
                onPress={handleDeleteAccount}
                style={{
                  flex: 1,
                  backgroundColor: "#7f1d1d",
                  borderRadius: 10,
                  padding: 12,
                  alignItems: "center",
                  opacity: deletingAccount ? 0.6 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>
                  {deletingAccount ? "Deleting..." : "Delete"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Settings;
