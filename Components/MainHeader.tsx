import { auth, db } from "@/config/firebaseConfig";
import { icons } from "@/constants/icons";
import { Colors, Spacing } from "@/constants/theme";
import { getGreeting } from "@/lib/greetings";
import { Link } from "expo-router";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

const greeting = getGreeting();
const BellIcon = icons.bell;

type ProductLike = { id: string; name?: string; stock?: number | string };
type InvoiceLike = {
  id: string;
  client?: string;
  invoiceNumber?: string;
  status?: string;
  amount?: number;
  amountPaid?: number;
};

type NotificationItem = {
  id: string;
  title: string;
  subtitle: string;
  color: string;
};

const MainHeader = () => {
  const [userName, setUserName] = useState<string>("");
  const [orgId, setOrgId] = useState<string>("");
  const [products, setProducts] = useState<ProductLike[]>([]);
  const [invoices, setInvoices] = useState<InvoiceLike[]>([]);
  const [notifModalVisible, setNotifModalVisible] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsubscribe = onSnapshot(doc(db, "users", uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserName(data.name);
        setOrgId(data.orgId ?? "");
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, "products"), where("orgId", "==", orgId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ProductLike, "id">),
        })),
      );
    });
    return unsubscribe;
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, "invoices"), where("orgId", "==", orgId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInvoices(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<InvoiceLike, "id">),
        })),
      );
    });
    return unsubscribe;
  }, [orgId]);

  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];

    products.forEach((p) => {
      const stock =
        typeof p.stock === "number" ? p.stock : Number(p.stock ?? NaN);
      if (isNaN(stock)) return;
      if (stock === 0) {
        items.push({
          id: `out-${p.id}`,
          title: "Out of stock",
          subtitle: `${p.name ?? "A product"} has no remaining stock`,
          color: "#ef4444",
        });
      } else if (stock <= 10) {
        items.push({
          id: `low-${p.id}`,
          title: "Low stock",
          subtitle: `${p.name ?? "A product"} has only ${stock} left`,
          color: "#f59e0b",
        });
      }
    });

    invoices.forEach((inv) => {
      if (inv.status === "overdue") {
        const paid = inv.amountPaid ?? 0;
        const balance = (inv.amount ?? 0) - paid;
        items.push({
          id: `overdue-${inv.id}`,
          title: "Invoice overdue",
          subtitle: `${inv.invoiceNumber ?? "Invoice"} for ${
            inv.client ?? "a client"
          } is overdue${
            balance > 0
              ? ` — Rs. ${Math.round(balance).toLocaleString()} due`
              : ""
          }`,
          color: "#ef4444",
        });
      }
    });

    return items;
  }, [products, invoices]);

  return (
    <View className="home-header">
      <View className="flex-row justify-between items-center w-full">
        <View>
          <Text style={{ fontSize: Spacing[4] }} className=" text-text-muted">
            {greeting}
          </Text>
          <Text
            style={{ fontSize: Spacing[6] }}
            className=" text-text font-inter-bold"
          >
            {userName}
          </Text>
        </View>
        <View className="ml-3 flex-row items-center">
          <TouchableOpacity
            onPress={() => setNotifModalVisible(true)}
            className="mr-2 bg-overlay p-3"
            style={{ borderRadius: 12 }}
          >
            <BellIcon size={Spacing[6.5]} color={Colors.text} />
            {notifications.length > 0 && (
              <View
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  backgroundColor: "#ef4444",
                  borderRadius: 8,
                  minWidth: 16,
                  height: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 3,
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}
                >
                  {notifications.length > 9 ? "9+" : notifications.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <Link
            href="/(tabs)/settings"
            style={{
              fontSize: Spacing[4],
              borderRadius: 12,
            }}
            className="bg-primary p-3"
          >
            <Text className="text-text font-inter-bold">
              {userName
                ? userName
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()
                : "?"}
            </Text>
          </Link>
        </View>
      </View>

      <Modal
        visible={notifModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setNotifModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: Colors.background ?? "#111",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
              maxHeight: "70%",
            }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text
                className="text-text font-inter-bold"
                style={{ fontSize: Spacing[5] }}
              >
                Notifications
              </Text>
              <TouchableOpacity onPress={() => setNotifModalVisible(false)}>
                <Text className="text-text-muted">Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {notifications.length === 0 ? (
                <Text
                  className="text-text-muted font-inter"
                  style={{ padding: 12 }}
                >
                  You're all caught up — no alerts right now.
                </Text>
              ) : (
                notifications.map((n) => (
                  <View
                    key={n.id}
                    style={{
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: n.color,
                        fontWeight: "700",
                        fontSize: 13,
                      }}
                    >
                      {n.title}
                    </Text>
                    <Text
                      className="text-text-muted font-inter"
                      style={{ fontSize: 13, marginTop: 2 }}
                    >
                      {n.subtitle}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default MainHeader;
