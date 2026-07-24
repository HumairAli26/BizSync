import { auth, db } from "@/config/firebaseConfig";
import { icons } from "@/constants/icons";
import { Colors, Spacing } from "@/constants/theme";
import { useRouter } from "expo-router";
import {
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";

const DESKTOP_BREAKPOINT = 900;

const MoveUPRight = icons.moveupright;
const MoveDownRight = icons.movedownright;

type Transaction = {
  id: string;
  client?: string;
  invoiceNumber?: string;
  amount: number;
  createdAt: number;
  type?: string;
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

// Recent Transactions — reads the real `sales` collection.
type RecentTransactionsProps = {
  // Route to navigate to when "See All" is pressed. Update this to match
  // whatever your full-transactions screen is registered as in app/.
  seeAllHref?: string;
};

const RecentTransactions = ({
  seeAllHref = "/transactions",
}: RecentTransactionsProps) => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
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
    <View
      className="rounded-3xl border border-border-light bg-background p-3"
      style={{
        minHeight: 380,
        height: isDesktop ? 420 : undefined,
        maxHeight: isDesktop ? 420 : undefined,
        overflow: "hidden",
        padding: 20,
      }}
    >
      {/*
        A plain ScrollView instead of FlatList: this component sits inside a
        parent ScrollView, and nesting a FlatList (VirtualizedList) inside a
        ScrollView of the same orientation breaks scroll gestures in RN.
        A regular ScrollView nests safely and scrolls independently within
        its fixed height because the parent hands it the touch responder.
      */}
      <ScrollView
        style={{ flex: 1 }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={true}
      >
        {transactions.map((t, index) => {
          const isOutgoing = t.amount < 0 || t.type === "purchase_payment";
          const amountColor = isOutgoing ? Colors.yellow : Colors.green;
          const iconBgClass = isOutgoing ? "bg-yellow-bg" : "bg-green-bg";
          const Icon = isOutgoing ? MoveDownRight : MoveUPRight;
          const amountText = `${isOutgoing ? "-" : "+"}${formatPKR(Math.abs(t.amount))}`;
          const descriptor = isOutgoing
            ? "Purchase payment"
            : "Invoice payment";

          return (
            <View key={t.id} style={{ paddingVertical: 12 }}>
              <View className="flex-row items-center" style={{ gap: 14 }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    overflow: "hidden",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isOutgoing
                      ? "rgba(245,158,11,0.15)"
                      : "rgba(34,197,94,0.15)",
                  }}
                >
                  <Icon color={amountColor} size={20} />
                </View>

                {/* Amount stays on the left, with more breathing room. */}
                <View style={{ width: 120, flexShrink: 0 }}>
                  <Text
                    style={{ color: amountColor, fontSize: 18 }}
                    className="font-inter-bold"
                    numberOfLines={1}
                  >
                    {amountText}
                  </Text>
                </View>

                {/* Name + descriptor column. */}
                <View style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
                  <Text
                    style={{ fontSize: Spacing[5] }}
                    className="text-text font-inter-bold"
                    numberOfLines={1}
                  >
                    {t.client || descriptor}
                  </Text>
                  <Text
                    className="text-text-muted"
                    style={{ fontSize: 13 }}
                    numberOfLines={1}
                  >
                    {descriptor} · {timeAgo(t.createdAt)}
                  </Text>
                </View>
              </View>

              {index < transactions.length - 1 && (
                <View
                  style={{
                    height: 1,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    marginVertical: 12,
                  }}
                />
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default RecentTransactions;
