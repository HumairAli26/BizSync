import { auth, db } from "@/config/firebaseConfig";
import { icons } from "@/constants/icons";
import { Colors, Spacing } from "@/constants/theme";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { styled } from "nativewind";
import React, { useMemo, useState } from "react";
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

const SearchIcon = icons.search;
const SafeAreaView = styled(RNSafeAreaView);

type CustomerStatus = "active" | "inactive";

type Customer = {
  id: string;
  name: string;
  email: string;
  status: CustomerStatus;
};

type Invoice = {
  id: string;
  client: string;
  customerId?: string;
  customerName?: string;
  invoiceNumber?: string;
  date?: string;
  amount: number;
  amountPaid?: number;
  status?: string;
  type?: "sales" | "purchase";
};

// Rotating avatar palette so initials get varied background colors
const AVATAR_COLORS = [
  { bg: "rgba(59,130,246,0.2)", fg: "#60a5fa" }, // blue
  { bg: "rgba(168,85,247,0.2)", fg: "#c084fc" }, // purple
  { bg: "rgba(249,115,22,0.2)", fg: "#fb923c" }, // orange
  { bg: "rgba(34,197,94,0.2)", fg: "#4ade80" }, // green
  { bg: "rgba(236,72,153,0.2)", fg: "#f472b6" }, // pink
  { bg: "rgba(234,179,8,0.2)", fg: "#facc15" }, // yellow
];

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

// Pakistani Rupee formatting (Rs. 1,23,456 style)
const formatPKR = (amount: number | null | undefined) => {
  const value = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  const isNegative = value < 0;
  const fixed = Math.round(Math.abs(value)).toString();

  let lastThree = fixed.slice(-3);
  const otherNumbers = fixed.slice(0, -3);
  if (otherNumbers !== "") {
    lastThree = "," + lastThree;
  }
  const formattedInt =
    otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;

  return `Rs. ${isNegative ? "-" : ""}${formattedInt}`;
};

const normalize = (s: string) => s.trim().toLowerCase();

// How much of an invoice has actually been paid — falls back to the full
// amount for old "paid" invoices created before partial payments existed.
const getAmountPaid = (invoice: Invoice) =>
  invoice.amountPaid ?? (invoice.status === "paid" ? invoice.amount : 0);

const Customers = () => {
  const [search, setSearch] = useState("");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    email: "",
  });

  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Customer>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [orgId, setOrgId] = useState<string>("");

  React.useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsubscribe = onSnapshot(doc(db, "users", uid), (snapshot) => {
      if (snapshot.exists()) setOrgId(snapshot.data().orgId ?? "");
    });
    return unsubscribe;
  }, []);

  // Real-time Firestore listener for customers — now actually scoped by orgId
  React.useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "customers"),
      where("orgId", "==", orgId),
      orderBy("name", "asc"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Customer, "id">),
        }));
        setCustomers(data);
        setLoading(false);
      },
      (error) => {
        console.error("Customers listener error:", error);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [orgId]);

  // Real-time Firestore listener for invoices (used to compute orders + lifetime value)
  React.useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, "invoices"), where("orgId", "==", orgId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Invoice, "id">),
        }));
        setInvoices(data);
      },
      (error) => {
        console.error("Invoices listener error (customers screen):", error);
      },
    );
    return () => unsubscribe();
  }, [orgId]);

  // Aggregate order count + lifetime value per customer by matching client name.
  // Lifetime value uses money actually collected (amountPaid), not the invoice total.
  const statsByCustomer = useMemo(() => {
    const map: Record<string, { orders: number; lifetimeValue: number }> = {};
    for (const invoice of invoices) {
      const key = normalize(invoice.client || "");
      if (!key) continue;
      if (!map[key]) map[key] = { orders: 0, lifetimeValue: 0 };
      map[key].orders += 1;
      map[key].lifetimeValue += getAmountPaid(invoice);
    }
    return map;
  }, [invoices]);

  const invoicesByCustomer = useMemo(() => {
    const map: Record<string, Invoice[]> = {};
    for (const customer of customers) {
      const key = customer.id;
      const normalizedName = normalize(customer.name);
      map[key] = invoices
        .filter((invoice) => {
          if (invoice.customerId) return invoice.customerId === customer.id;
          return normalize(invoice.client || "") === normalizedName;
        })
        .sort((a, b) => {
          const ad = new Date(a.date ?? 0).getTime();
          const bd = new Date(b.date ?? 0).getTime();
          return bd - ad;
        });
    }
    return map;
  }, [customers, invoices]);

  const filteredCustomers = useMemo(() => {
    let list = customers;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
      );
    }
    return list;
  }, [customers, search]);

  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim()) {
      Alert.alert("Missing info", "Customer name is required.");
      return;
    }

    setSavingAdd(true);
    try {
      await addDoc(collection(db, "customers"), {
        orgId,
        name: newCustomer.name.trim(),
        email: newCustomer.email.trim(),
        status: "active",
        createdAt: Date.now(),
      });
      setNewCustomer({ name: "", email: "" });
      setAddModalVisible(false);
    } catch (error) {
      console.error("Error adding customer:", error);
      Alert.alert("Error", "Could not add customer. Please try again.");
    } finally {
      setSavingAdd(false);
    }
  };

  const startEdit = (customer: Customer) => {
    setEditId(customer.id);
    setEditDraft({ ...customer });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditDraft({});
  };

  const saveEdit = async (id: string) => {
    if (!editDraft.name?.trim()) {
      Alert.alert("Missing info", "Customer name is required.");
      return;
    }

    setSavingEdit(true);
    try {
      await updateDoc(doc(db, "customers", id), {
        name: editDraft.name.trim(),
        email: editDraft.email?.trim() ?? "",
        status: editDraft.status ?? "active",
      });
      setEditId(null);
      setEditDraft({});
    } catch (error) {
      console.error("Error updating customer:", error);
      Alert.alert("Error", "Could not save changes. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete customer", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "customers", id));
          } catch (error) {
            console.error("Error deleting customer:", error);
          }
        },
      },
    ]);
  };

  const toggleStatus = async (customer: Customer) => {
    try {
      await updateDoc(doc(db, "customers", customer.id), {
        status: customer.status === "active" ? "inactive" : "active",
      });
    } catch (error) {
      console.error("Error toggling status:", error);
      Alert.alert("Error", "Could not update status. Please try again.");
    }
  };

  const toggleExpand = (id: string) => {
    if (editId && editId !== id) cancelEdit();
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <SafeAreaView className="flex-1 bg-background p-5">
      {/* Header */}
      <View className="home-header">
        <View className="flex-row justify-between items-center w-full">
          <View>
            <Text
              style={{ fontSize: Spacing[7] }}
              className="text-text font-inter-bold"
            >
              Customers
            </Text>
          </View>
          <View className="ml-3 flex-row items-center">
            <TouchableOpacity
              onPress={() => setAddModalVisible(true)}
              style={{
                borderRadius: 12,
                paddingHorizontal: 25,
                paddingVertical: 12,
              }}
              className="bg-primary"
            >
              <Text
                style={{ fontSize: Spacing[4] }}
                className="text-text font-inter-bold"
              >
                + Add
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Search */}
      <View className="search-container">
        <SearchIcon color={Colors.textMuted} className="search-icon" />
        <TextInput
          placeholder="Search customers..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          style={{
            flex: 1,
            fontSize: Spacing[4],
            color: Colors.text,
            paddingVertical: 0,
          }}
        />
      </View>

      {/* Customer list / empty state */}
      <ScrollView showsVerticalScrollIndicator={false} className="mt-4">
        {loading ? (
          <View className="items-center justify-center py-20">
            <Text className="text-text-muted font-inter">
              Loading customers...
            </Text>
          </View>
        ) : filteredCustomers.length === 0 ? (
          <View className="items-center justify-center py-20">
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "rgba(255,255,255,0.05)",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 28 }}>👤</Text>
            </View>
            <Text
              className="text-text font-inter-bold"
              style={{ fontSize: Spacing[5] }}
            >
              No customers yet
            </Text>
            <Text className="text-text-muted font-inter mt-1">
              Tap "+ Add" to create your first customer
            </Text>
          </View>
        ) : (
          filteredCustomers.map((customer) => {
            const isExpanded = expandedId === customer.id;
            const isEditing = editId === customer.id;
            const avatar = getAvatarColor(customer.name);
            const stats = statsByCustomer[normalize(customer.name)] ?? {
              orders: 0,
              lifetimeValue: 0,
            };
            const isActive = customer.status !== "inactive";
            const customerInvoices = invoicesByCustomer[customer.id] ?? [];

            return (
              <TouchableOpacity
                key={customer.id}
                activeOpacity={0.85}
                onPress={() => toggleExpand(customer.id)}
                style={{
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.1)",
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                {/* Top row */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center" style={{ flex: 1 }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: avatar.bg,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: avatar.fg,
                          fontWeight: "700",
                          fontSize: 14,
                        }}
                      >
                        {getInitials(customer.name)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        className="text-text font-inter-bold"
                        style={{ fontSize: Spacing[4] }}
                      >
                        {customer.name}
                      </Text>
                      <Text
                        className="text-text-muted font-inter"
                        style={{ fontSize: Spacing[3] }}
                      >
                        {customer.email}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      backgroundColor: isActive
                        ? "rgba(34,197,94,0.15)"
                        : "rgba(156,163,175,0.15)",
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 20,
                    }}
                  >
                    <Text
                      style={{
                        color: isActive ? "#22c55e" : "#9ca3af",
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {isActive ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>

                {/* Divider */}
                <View
                  style={{
                    height: 1,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    marginVertical: 12,
                  }}
                />

                {/* Stats */}
                <View className="flex-row items-center" style={{ gap: 32 }}>
                  <View>
                    <Text
                      className="text-text font-inter-bold"
                      style={{ fontSize: Spacing[5] }}
                    >
                      {stats.orders}
                    </Text>
                    <Text
                      className="text-text-muted font-inter"
                      style={{ fontSize: 12 }}
                    >
                      Orders
                    </Text>
                  </View>
                  <View>
                    <Text
                      className="font-inter-bold"
                      style={{ fontSize: Spacing[5], color: "#60a5fa" }}
                    >
                      {formatPKR(stats.lifetimeValue)}
                    </Text>
                    <Text
                      className="text-text-muted font-inter"
                      style={{ fontSize: 12 }}
                    >
                      Lifetime Value
                    </Text>
                  </View>
                </View>

                {/* Expanded / editable section */}
                {isExpanded && (
                  <View
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTopWidth: 1,
                      borderTopColor: "rgba(255,255,255,0.08)",
                    }}
                  >
                    {isEditing ? (
                      <View>
                        <TextInput
                          value={editDraft.name}
                          onChangeText={(t) =>
                            setEditDraft((d) => ({ ...d, name: t }))
                          }
                          placeholder="Customer name"
                          placeholderTextColor={Colors.textMuted}
                          style={editInputStyle}
                        />
                        <TextInput
                          value={editDraft.email}
                          onChangeText={(t) =>
                            setEditDraft((d) => ({ ...d, email: t }))
                          }
                          placeholder="Email"
                          placeholderTextColor={Colors.textMuted}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          style={editInputStyle}
                        />

                        {/* Status chips */}
                        <View className="flex-row flex-wrap gap-2 mb-3">
                          {(["active", "inactive"] as CustomerStatus[]).map(
                            (statusKey) => {
                              const active = editDraft.status === statusKey;
                              return (
                                <TouchableOpacity
                                  key={statusKey}
                                  onPress={(e: any) => {
                                    e.stopPropagation?.();
                                    setEditDraft((d) => ({
                                      ...d,
                                      status: statusKey,
                                    }));
                                  }}
                                  style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 20,
                                    backgroundColor: active
                                      ? "rgba(34,197,94,0.15)"
                                      : "rgba(255,255,255,0.05)",
                                    borderWidth: 1,
                                    borderColor: active
                                      ? "#22c55e"
                                      : "rgba(255,255,255,0.1)",
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: active
                                        ? "#22c55e"
                                        : Colors.textMuted,
                                      fontSize: 12,
                                      fontWeight: "600",
                                      textTransform: "capitalize",
                                    }}
                                  >
                                    {statusKey}
                                  </Text>
                                </TouchableOpacity>
                              );
                            },
                          )}
                        </View>

                        <View className="flex-row gap-3">
                          <TouchableOpacity
                            disabled={savingEdit}
                            onPress={(e: any) => {
                              e.stopPropagation?.();
                              saveEdit(customer.id);
                            }}
                            style={{
                              flex: 1,
                              backgroundColor: Colors.primary ?? "#4b7c59",
                              borderRadius: 10,
                              paddingVertical: 10,
                              alignItems: "center",
                              opacity: savingEdit ? 0.6 : 1,
                            }}
                          >
                            <Text className="text-text font-inter-bold">
                              {savingEdit ? "Saving..." : "Save"}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={(e: any) => {
                              e.stopPropagation?.();
                              cancelEdit();
                            }}
                            style={{
                              flex: 1,
                              backgroundColor: "rgba(255,255,255,0.08)",
                              borderRadius: 10,
                              paddingVertical: 10,
                              alignItems: "center",
                            }}
                          >
                            <Text className="text-text font-inter">Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View>
                        <Text
                          className="text-text font-inter-bold"
                          style={{ fontSize: 13, marginBottom: 8 }}
                        >
                          Linked Invoices ({customerInvoices.length})
                        </Text>

                        {customerInvoices.length === 0 ? (
                          <Text
                            className="text-text-muted font-inter"
                            style={{ fontSize: 12, marginBottom: 10 }}
                          >
                            No invoices found for this customer yet.
                          </Text>
                        ) : (
                          <ScrollView
                            nestedScrollEnabled
                            showsVerticalScrollIndicator={false}
                            style={{ maxHeight: 170, marginBottom: 10 }}
                          >
                            {customerInvoices.map((invoice) => (
                              <View
                                key={`${customer.id}-${invoice.id}`}
                                className="flex-row items-center justify-between"
                                style={{
                                  paddingVertical: 8,
                                  borderBottomWidth: 1,
                                  borderBottomColor: "rgba(255,255,255,0.06)",
                                }}
                              >
                                <View style={{ flex: 1, paddingRight: 10 }}>
                                  <Text
                                    className="text-text font-inter-bold"
                                    style={{ fontSize: 12 }}
                                    numberOfLines={1}
                                  >
                                    {invoice.invoiceNumber ?? "Invoice"} ·{" "}
                                    {invoice.date ?? "-"}
                                  </Text>
                                  <Text
                                    className="text-text-muted font-inter"
                                    style={{ fontSize: 11 }}
                                    numberOfLines={1}
                                  >
                                    {(invoice.type ?? "sales").toUpperCase()} ·{" "}
                                    {(
                                      invoice.status ?? "pending"
                                    ).toUpperCase()}
                                  </Text>
                                </View>
                                <Text
                                  className="font-inter-bold"
                                  style={{ color: "#60a5fa", fontSize: 12 }}
                                >
                                  {formatPKR(invoice.amount)}
                                </Text>
                              </View>
                            ))}
                          </ScrollView>
                        )}

                        <View className="flex-row gap-3">
                          <TouchableOpacity
                            onPress={(e: any) => {
                              e.stopPropagation?.();
                              startEdit(customer);
                            }}
                            style={{
                              flex: 1,
                              backgroundColor: "rgba(255,255,255,0.08)",
                              borderRadius: 10,
                              paddingVertical: 10,
                              alignItems: "center",
                            }}
                          >
                            <Text className="text-text font-inter-bold">
                              Edit
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={(e: any) => {
                              e.stopPropagation?.();
                              toggleStatus(customer);
                            }}
                            style={{
                              flex: 1,
                              backgroundColor: "rgba(255,255,255,0.08)",
                              borderRadius: 10,
                              paddingVertical: 10,
                              alignItems: "center",
                            }}
                          >
                            <Text className="text-text font-inter-bold">
                              {isActive ? "Set Inactive" : "Set Active"}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={(e: any) => {
                              e.stopPropagation?.();
                              handleDelete(customer.id);
                            }}
                            style={{
                              flex: 1,
                              backgroundColor: "rgba(239,68,68,0.15)",
                              borderRadius: 10,
                              paddingVertical: 10,
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{ color: "#ef4444" }}
                              className="font-inter-bold"
                            >
                              Delete
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Add Customer Modal */}
      <Modal visible={addModalVisible} animationType="slide" transparent>
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
            }}
          >
            <Text
              className="text-text font-inter-bold"
              style={{ fontSize: Spacing[5], marginBottom: 12 }}
            >
              New Customer
            </Text>

            <TextInput
              value={newCustomer.name}
              onChangeText={(t) => setNewCustomer((p) => ({ ...p, name: t }))}
              placeholder="Customer name"
              placeholderTextColor={Colors.textMuted}
              style={editInputStyle}
            />
            <TextInput
              value={newCustomer.email}
              onChangeText={(t) => setNewCustomer((p) => ({ ...p, email: t }))}
              placeholder="Email"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              style={editInputStyle}
            />

            <View className="flex-row gap-3 mt-1">
              <TouchableOpacity
                disabled={savingAdd}
                onPress={handleAddCustomer}
                style={{
                  flex: 1,
                  backgroundColor: Colors.primary ?? "#4b7c59",
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: savingAdd ? 0.6 : 1,
                }}
              >
                <Text className="text-text font-inter-bold">
                  {savingAdd ? "Creating..." : "Create Customer"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setAddModalVisible(false)}
                style={{
                  flex: 1,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text className="text-text font-inter">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const editInputStyle = {
  backgroundColor: "rgba(255,255,255,0.05)",
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 10,
  color: Colors.text,
  marginBottom: 10,
  fontSize: 14,
};

export default Customers;
