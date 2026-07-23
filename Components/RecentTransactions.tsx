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
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

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
      style={{ height: 300, overflow: "hidden" }}
    >
      <View
        className="flex-row items-center justify-between"
        style={{ paddingHorizontal: 4, paddingBottom: 8 }}
      >
        <Text
          className="text-text font-inter-bold"
          style={{ fontSize: Spacing[4] }}
        >
          Recent Transactions
        </Text>
        <TouchableOpacity onPress={() => router.push(seeAllHref as any)}>
          <Text
            className="font-inter-bold"
            style={{ color: Colors.green, fontSize: 13 }}
          >
            See All
          </Text>
        </TouchableOpacity>
      </View>

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
            <View key={t.id}>
              <View className="flex-row items-center">
                <View
                  style={{ borderRadius: 12 }}
                  className={`card-icon ${iconBgClass}`}
                >
                  <Icon color={amountColor} />
                </View>

                {/* Price sits immediately after the icon, to the left of the
                    name/info column below. */}
                <View className="ml-3" style={{ width: 90, flexShrink: 0 }}>
                  <Text
                    style={{ color: amountColor, fontSize: 13 }}
                    className="font-inter-bold"
                    numberOfLines={1}
                  >
                    {amountText}
                  </Text>
                </View>

                {/* Name + descriptor column, to the right of the price. */}
                <View style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
                  <Text
                    style={{ fontSize: Spacing[4] }}
                    className="text-text font-inter-bold"
                    numberOfLines={1}
                  >
                    {t.client || descriptor}
                  </Text>
                  <Text
                    className="text-text-muted"
                    style={{ fontSize: 12 }}
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
                    marginVertical: 10,
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
