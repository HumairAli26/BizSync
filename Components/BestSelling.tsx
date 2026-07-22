import { auth, db } from "@/config/firebaseConfig";
import { Spacing } from "@/constants/theme";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";

type InvoiceItem = {
  name: string;
  quantity: number;
};

type InvoiceLike = {
  items?: InvoiceItem[];
};

type Product = {
  id: string;
  name: string;
  category?: string;
  price?: string | number;
  stock?: number;
};

const getStatus = (stock: number) => {
  if (stock === 0)
    return {
      label: "Out of Stock",
      color: "#ef4444",
      bg: "rgba(239,68,68,0.15)",
    };
  if (stock <= 10)
    return { label: "Critical", color: "#ef4444", bg: "rgba(239,68,68,0.15)" };
  if (stock <= 25)
    return {
      label: "Low Stock",
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.15)",
    };
  return { label: "In Stock", color: "#22c55e", bg: "rgba(34,197,94,0.15)" };
};

const formatPKR = (amount: number | string | null | undefined) => {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  const safe = typeof value === "number" && !isNaN(value) ? value : 0;
  const fixed = Math.round(Math.abs(safe)).toString();
  let lastThree = fixed.slice(-3);
  const otherNumbers = fixed.slice(0, -3);
  if (otherNumbers !== "") lastThree = "," + lastThree;
  const formattedInt =
    otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
  return `Rs. ${formattedInt}`;
};

const normalize = (s: string) => s.trim().toLowerCase();

// Best Selling — ranks products by total quantity sold across all invoice
// line items, then cross-references live stock/price from the products collection.
const BestSelling = () => {
  const [orgId, setOrgId] = useState<string>("");
  const [invoices, setInvoices] = useState<InvoiceLike[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
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
    const q = query(collection(db, "invoices"), where("orgId", "==", orgId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setInvoices(snapshot.docs.map((d) => d.data() as InvoiceLike));
        setLoading(false);
      },
      (error) => {
        console.error("Best selling (invoices) listener error:", error);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, "products"), where("orgId", "==", orgId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Product, "id">),
        })),
      );
    });
    return unsubscribe;
  }, [orgId]);

  const bestSelling = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const invoice of invoices) {
      for (const item of invoice.items ?? []) {
        const key = normalize(item.name);
        if (!key) continue;
        totals[key] = (totals[key] || 0) + (item.quantity || 0);
      }
    }

    return Object.entries(totals)
      .map(([key, qty]) => {
        const product = products.find((p) => normalize(p.name) === key);
        return {
          key,
          name: product?.name ?? key,
          qty,
          price: product?.price,
          stock: product?.stock,
          category: product?.category,
        };
      })
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3);
  }, [invoices, products]);

  if (loading) {
    return (
      <View className="product-card">
        <Text className="text-text-muted font-inter" style={{ padding: 12 }}>
          Loading...
        </Text>
      </View>
    );
  }

  if (bestSelling.length === 0) {
    return (
      <View className="product-card">
        <Text className="text-text-muted font-inter" style={{ padding: 12 }}>
          No sales yet
        </Text>
      </View>
    );
  }

  return (
    <View>
      {bestSelling.map((item, index) => {
        const status =
          typeof item.stock === "number" ? getStatus(item.stock) : null;
        return (
          <View key={item.key} className="product-card">
            <View className="flex-row items-center justify-between w-full">
              <View className="flex-row items-center" style={{ flex: 1 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: "rgba(255,255,255,0.05)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Text className="text-text-muted font-inter-bold">
                    #{index + 1}
                  </Text>
                </View>
                <View>
                  <Text
                    className="text-text font-inter-bold"
                    style={{ fontSize: Spacing[4] }}
                  >
                    {item.name}
                  </Text>
                  <Text className="text-text-muted" style={{ fontSize: 12 }}>
                    {item.category ?? `${item.qty} sold`}
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                {item.price !== undefined && (
                  <Text className="text-text font-inter-bold">
                    {formatPKR(item.price)}
                  </Text>
                )}
                {status && (
                  <View
                    style={{
                      backgroundColor: status.bg,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 12,
                      marginTop: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: status.color,
                        fontSize: 11,
                        fontWeight: "600",
                      }}
                    >
                      {status.label}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default BestSelling;
