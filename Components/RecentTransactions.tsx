import { auth, db } from "@/config/firebaseConfig";
import { icons } from "@/constants/icons";
import { Colors, Spacing } from "@/constants/theme";
import {
    collection,
    doc,
    limit,
    onSnapshot,
    orderBy,
    query,
    where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";

const MoveUPRight = icons.moveupright;

type Transaction = {
  id: string;
  client?: string;
  invoiceNumber?: string;
  amount: number;
  createdAt: number;
};

const formatPKR = (amount: number | null | undefined) => {
  const value = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  const fixed = Math.round(Math.abs(value)).toString();
  let lastThree = fixed.slice(-3);
  const otherNumbers = fixed.slice(0, -3);
  if (otherNumbers !== "") lastThree = "," + lastThree;
  const formattedInt =
    otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
  return `Rs. ${formattedInt}`;
};

const timeAgo = (timestamp: number) => {
  if (!timestamp) return "";
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

// Recent Transactions — reads the real `sales` collection, which is written to
// whenever an invoice payment (full or partial) is recorded. There is currently
// no expense/outgoing-payment feature in the app, so every entry here is an
// incoming invoice payment.
const RecentTransactions = () => {
  const [orgId, setOrgId] = useState<string>("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsubscribe = onSnapshot(doc(db, "users", uid), (snapshot) => {
      if (snapshot.exists()) setOrgId(snapshot.data().orgId ?? "");
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "sales"),
      where("orgId", "==", orgId),
      orderBy("createdAt", "desc"),
      limit(5),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setTransactions(
          snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Transaction, "id">),
          })),
        );
        setLoading(false);
      },
      (error) => {
        console.error("Recent transactions listener error:", error);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [orgId]);

  if (loading) {
    return (
      <View className="transactions-card">
        <Text className="text-text-muted font-inter" style={{ padding: 12 }}>
          Loading...
        </Text>
      </View>
    );
  }

  if (transactions.length === 0) {
    return (
      <View className="transactions-card">
        <Text className="text-text-muted font-inter" style={{ padding: 12 }}>
          No transactions yet
        </Text>
      </View>
    );
  }

  return (
    <View>
      {transactions.map((t) => (
        <View key={t.id} className="transactions-card">
          <View style={{ borderRadius: 12 }} className="card-icon bg-green-bg">
            <MoveUPRight color={Colors.green} />
          </View>
          <View className="flex-row justify-between items-center w-full ml-3">
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: Spacing[4] }}
                className="text-text font-inter-bold"
              >
                {t.client || "Invoice payment"}
              </Text>
              <Text className="text-text-muted" style={{ fontSize: 12 }}>
                Invoice payment · {timeAgo(t.createdAt)}
              </Text>
            </View>
            <Text style={{ color: Colors.green }} className="font-inter-bold">
              +{formatPKR(t.amount)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
};

export default RecentTransactions;
