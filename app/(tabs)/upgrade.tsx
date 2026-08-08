import { auth, db, storage } from "@/config/firebaseConfig";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import {
    addDoc,
    collection,
    doc,
    getDoc,
    serverTimestamp,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { styled } from "nativewind";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

const PRO_PRICE = "Rs. 5,199";

// TODO: replace with your real bank account details before shipping payments
const PAYMENT_DETAILS = {
    accountTitle: "Humair Ali Awan",
    accountNumber: "0153-10097841-09",
    bankName: "Bank Alfalah",
    iban: "PK16ALFH0153001009784109",
};

const proFeatures = [
    {
        title: "Daily & Weekly Ledger",
        description:
            "Automatic daily and weekly ledger summaries so you always know where your business stands.",
    },
    {
        title: "Client-Linked Invoices",
        description:
            "Link clients directly to their invoices for instant, one-tap access to their full billing history.",
    },
    {
        title: "Unlimited Quotations",
        description:
            "Create as many quotations as you need — no monthly cap, no limits.",
    },
    {
        title: "Advanced Management Tools",
        description:
            "Deeper reporting and management controls built for growing teams.",
    },
];

type Step = "features" | "payment";

const Upgrade = () => {
    const [step, setStep] = useState<Step>("features");
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handlePickScreenshot = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert(
                "Permission needed",
                "Allow photo access to upload your payment screenshot.",
            );
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
        });

        if (!result.canceled && result.assets?.[0]?.uri) {
            setScreenshot(result.assets[0].uri);
        }
    };

    const handleSubmitProof = async () => {
        if (!screenshot) {
            Alert.alert(
                "Screenshot required",
                "Please upload a screenshot of your payment before submitting.",
            );
            return;
        }

        const uid = auth.currentUser?.uid;
        if (!uid) return;

        setSubmitting(true);
        try {
            const userSnap = await getDoc(doc(db, "users", uid));
            const orgId = userSnap.data()?.orgId;
            if (!orgId) throw new Error("Could not find your organization.");

            // Upload screenshot to Firebase Storage
            const response = await fetch(screenshot);
            const blob = await response.blob();
            const storageRef = ref(
                storage,
                `paymentProofs/${orgId}/${Date.now()}.jpg`,
            );
            await uploadBytes(storageRef, blob);
            const proofUrl = await getDownloadURL(storageRef);

            // Create a pending payment request for manual approval
            await addDoc(collection(db, "paymentRequests"), {
                orgId,
                plan: "pro",
                amount: PRO_PRICE,
                proofUrl,
                status: "pending",
                submittedAt: serverTimestamp(),
            });

            Alert.alert(
                "Submitted",
                "Your payment proof has been submitted. We'll activate your Pro plan within 24 hours after verification.",
                [{ text: "OK", onPress: () => router.back() }],
            );
        } catch (err: any) {
            Alert.alert(
                "Submission failed",
                err.message ?? "Something went wrong. Please try again.",
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background p-5">
            <ScrollView showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                    onPress={() =>
                        step === "payment" ? setStep("features") : router.back()
                    }
                    style={{ marginBottom: 16 }}
                >
                    <Text className="text-text-muted">← Back</Text>
                </TouchableOpacity>

                {step === "features" ? (
                    <>
                        <Text
                            className="text-text font-inter-bold"
                            style={{ fontSize: 24 }}
                        >
                            Upgrade to Pro
                        </Text>
                        <Text
                            className="text-text font-inter-bold"
                            style={{ fontSize: 18, marginTop: 6 }}
                        >
                            {PRO_PRICE}{" "}
                            <Text
                                className="text-text-muted"
                                style={{ fontSize: 13, fontWeight: "400" }}
                            >
                                / month
                            </Text>
                        </Text>
                        <Text
                            className="text-text-muted"
                            style={{ marginTop: 8, marginBottom: 24 }}
                        >
                            Unlock everything BizSync has to offer for your organization.
                        </Text>

                        {proFeatures.map((feature) => (
                            <View
                                key={feature.title}
                                className="home-balance-card mb-3"
                                style={{ paddingVertical: 16, paddingHorizontal: 16 }}
                            >
                                <Text
                                    className="text-text font-inter-bold"
                                    style={{ fontSize: 15 }}
                                >
                                    {feature.title}
                                </Text>
                                <Text
                                    className="text-text-muted"
                                    style={{ marginTop: 6, fontSize: 13 }}
                                >
                                    {feature.description}
                                </Text>
                            </View>
                        ))}

                        <TouchableOpacity
                            onPress={() => setStep("payment")}
                            style={{
                                borderRadius: 14,
                                height: 52,
                                alignItems: "center",
                                justifyContent: "center",
                                marginTop: 12,
                                marginBottom: 40,
                            }}
                            className="bg-primary"
                        >
                            <Text
                                className="text-text font-inter-extrabold"
                                style={{ fontSize: 16 }}
                            >
                                Upgrade Now
                            </Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <Text
                            className="text-text font-inter-bold"
                            style={{ fontSize: 22 }}
                        >
                            Complete Your Payment
                        </Text>
                        <Text
                            className="text-text-muted"
                            style={{ marginTop: 8, marginBottom: 20 }}
                        >
                            Transfer {PRO_PRICE} using the details below, then upload a
                            screenshot as proof.
                        </Text>

                        <View
                            className="home-balance-card mb-5"
                            style={{ paddingVertical: 16, paddingHorizontal: 16 }}
                        >
                            <Text className="text-text-muted" style={{ fontSize: 12 }}>
                                Account Title
                            </Text>
                            <Text
                                className="text-text font-inter-bold"
                                style={{ marginTop: 4, marginBottom: 14 }}
                            >
                                {PAYMENT_DETAILS.accountTitle}
                            </Text>

                            <Text className="text-text-muted" style={{ fontSize: 12 }}>
                                Account Number
                            </Text>
                            <Text
                                className="text-text font-inter-bold"
                                style={{ marginTop: 4, marginBottom: 14 }}
                            >
                                {PAYMENT_DETAILS.accountNumber}
                            </Text>

                            <Text className="text-text-muted" style={{ fontSize: 12 }}>
                                Bank
                            </Text>
                            <Text
                                className="text-text font-inter-bold"
                                style={{ marginTop: 4, marginBottom: 14 }}
                            >
                                {PAYMENT_DETAILS.bankName}
                            </Text>

                            <Text className="text-text-muted" style={{ fontSize: 12 }}>
                                IBAN
                            </Text>
                            <Text
                                className="text-text font-inter-bold"
                                style={{ marginTop: 4 }}
                            >
                                {PAYMENT_DETAILS.iban}
                            </Text>
                        </View>

                        <Text
                            className="text-text font-inter-bold"
                            style={{ fontSize: 14, marginBottom: 10 }}
                        >
                            Upload Payment Screenshot
                        </Text>

                        <TouchableOpacity
                            onPress={handlePickScreenshot}
                            className="home-balance-card mb-5"
                            style={{
                                paddingVertical: screenshot ? 0 : 24,
                                paddingHorizontal: 16,
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                            }}
                        >
                            {screenshot ? (
                                <Image
                                    source={{ uri: screenshot }}
                                    style={{ width: "100%", height: 220, borderRadius: 10 }}
                                    resizeMode="cover"
                                />
                            ) : (
                                <Text className="text-text-muted">
                                    Tap to select a screenshot
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            disabled={submitting}
                            onPress={handleSubmitProof}
                            style={{
                                borderRadius: 14,
                                height: 52,
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: 40,
                                opacity: submitting ? 0.6 : 1,
                            }}
                            className="bg-primary"
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text
                                    className="text-text font-inter-extrabold"
                                    style={{ fontSize: 16 }}
                                >
                                    Submit Payment Proof
                                </Text>
                            )}
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default Upgrade;
