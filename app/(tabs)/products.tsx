import { auth, db } from "@/config/firebaseConfig";
import { icons } from "@/constants/icons";
import { Colors, Spacing } from "@/constants/theme";
import { formatCurrency } from "@/lib/utils";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
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

type Product = {
  id: string;
  name: string;
  sku: string;
  skuUpper?: string;
  category: string;
  price: string;
  stock: number;
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

const ProductsScreen = () => {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Product>>({});
  const [orgId, setOrgId] = useState<string>("");

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    sku: "",
    category: "",
    price: "",
    stock: "",
  });
  const [savingAdd, setSavingAdd] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Get the current user's orgId
  React.useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsubscribe = onSnapshot(doc(db, "users", uid), (snapshot) => {
      if (snapshot.exists()) setOrgId(snapshot.data().orgId ?? "");
    });
    return unsubscribe;
  }, []);

  // Real-time Firestore listener, now scoped to the current org
  React.useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "products"),
      where("orgId", "==", orgId),
      orderBy("name"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Product, "id">),
        }));
        setProducts(data);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore listener error:", error);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [orgId]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }, [products, search]);

  const stats = useMemo(() => {
    const total = products.length;
    const low = products.filter((p) => p.stock > 0 && p.stock <= 25).length;
    const out = products.filter((p) => p.stock === 0).length;
    return { total, low, out };
  }, [products]);

  // Checks Firestore for an existing product with the same SKU within this org
  // (case-insensitive) — two different orgs can reuse the same SKU safely.
  const isSkuTaken = async (sku: string, excludeId?: string) => {
    const normalizedSku = sku.trim().toUpperCase();
    if (!normalizedSku || !orgId) return false;
    const q = query(
      collection(db, "products"),
      where("orgId", "==", orgId),
      where("skuUpper", "==", normalizedSku),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return false;
    return snapshot.docs.some((d) => d.id !== excludeId);
  };

  const handleAddProduct = async () => {
    if (!newProduct.name.trim() || !newProduct.sku.trim()) {
      Alert.alert("Missing info", "Name and SKU are required.");
      return;
    }

    setSavingAdd(true);
    try {
      const taken = await isSkuTaken(newProduct.sku);
      if (taken) {
        Alert.alert(
          "Duplicate SKU",
          "This SKU already exists. Please enter a different SKU.",
        );
        return;
      }

      await addDoc(collection(db, "products"), {
        orgId,
        name: newProduct.name.trim(),
        sku: newProduct.sku.trim(),
        skuUpper: newProduct.sku.trim().toUpperCase(),
        category: newProduct.category.trim() || "Uncategorized",
        price: newProduct.price.trim() || "0",
        stock: parseInt(newProduct.stock, 10) || 0,
        createdAt: Date.now(),
      });
      setNewProduct({ name: "", sku: "", category: "", price: "", stock: "" });
      setAddModalVisible(false);
    } catch (error) {
      console.error("Error adding product:", error);
      Alert.alert("Error", "Could not add product. Please try again.");
    } finally {
      setSavingAdd(false);
    }
  };

  const startEdit = (product: Product) => {
    setEditId(product.id);
    setEditDraft({ ...product });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditDraft({});
  };

  const saveEdit = async (id: string) => {
    if (!editDraft.sku?.trim()) {
      Alert.alert("Missing info", "SKU is required.");
      return;
    }

    setSavingEdit(true);
    try {
      const taken = await isSkuTaken(editDraft.sku, id);
      if (taken) {
        Alert.alert(
          "Duplicate SKU",
          "This SKU already exists. Please enter a different SKU.",
        );
        return;
      }

      await updateDoc(doc(db, "products", id), {
        name: editDraft.name,
        sku: editDraft.sku.trim(),
        skuUpper: editDraft.sku.trim().toUpperCase(),
        category: editDraft.category,
        price: editDraft.price,
        stock:
          typeof editDraft.stock === "string"
            ? parseInt(editDraft.stock as unknown as string, 10) || 0
            : editDraft.stock,
      });
      setEditId(null);
      setEditDraft({});
    } catch (error) {
      console.error("Error updating product:", error);
      Alert.alert("Error", "Could not save changes. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete product", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "products", id));
          } catch (error) {
            console.error("Error deleting product:", error);
          }
        },
      },
    ]);
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
              Inventory
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
                style={{
                  fontSize: Spacing[4],
                }}
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
          placeholder="Search products..."
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

      {/* Stats */}
      <View className="flex-row gap-3 mb-4">
        <View className="home-balance-card">
          <View className="items-center">
            <Text
              style={{ fontSize: Spacing[5] }}
              className="text-blue-400 font-inter-bold"
            >
              {stats.total.toLocaleString()}
            </Text>
            <Text style={{ fontSize: Spacing[3] }} className="text-text-muted">
              Total
            </Text>
          </View>
        </View>
        <View className="home-balance-card">
          <View className="items-center">
            <Text
              style={{ fontSize: Spacing[5] }}
              className="text-yellow-300 font-inter-bold"
            >
              {stats.low}
            </Text>
            <Text style={{ fontSize: Spacing[3] }} className="text-text-muted">
              Low Stock
            </Text>
          </View>
        </View>
        <View className="home-balance-card">
          <View className="items-center">
            <Text
              style={{ fontSize: Spacing[5] }}
              className="font-inter-bold text-red-700"
            >
              {stats.out}
            </Text>
            <Text style={{ fontSize: Spacing[3] }} className="text-text-muted">
              Out of Stock
            </Text>
          </View>
        </View>
      </View>

      {/* Product list / empty state */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 10 }}
      >
        {loading ? (
          <View className="items-center justify-center py-20">
            <Text className="text-text-muted font-inter">
              Loading products...
            </Text>
          </View>
        ) : filteredProducts.length === 0 ? (
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
              <Text style={{ fontSize: 28 }}>📦</Text>
            </View>
            <Text
              className="text-text font-inter-bold"
              style={{ fontSize: Spacing[5] }}
            >
              No products added
            </Text>
            <Text className="text-text-muted font-inter mt-1">
              Tap "+ Add" to add your first product
            </Text>
          </View>
        ) : (
          filteredProducts.map((product) => {
            const status = getStatus(product.stock);
            const isExpanded = expandedId === product.id;
            const isEditing = editId === product.id;

            return (
              <TouchableOpacity
                key={product.id}
                activeOpacity={0.8}
                onPress={() => toggleExpand(product.id)}
                style={{
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.1)",
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <View className="flex-row items-center">
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: "rgba(255,255,255,0.05)",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ fontSize: 18 }}>📦</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View className="flex-row items-center justify-between">
                      <Text
                        className="text-text font-inter-bold"
                        style={{ fontSize: Spacing[4] }}
                      >
                        {product.name}
                      </Text>
                      <View
                        style={{
                          backgroundColor: status.bg,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 20,
                        }}
                      >
                        <Text
                          style={{
                            color: status.color,
                            fontSize: 12,
                            fontWeight: "600",
                          }}
                        >
                          {status.label}
                        </Text>
                      </View>
                    </View>
                    <Text
                      className="text-text-muted font-inter"
                      style={{ fontSize: Spacing[3] }}
                    >
                      {product.sku} · {product.category}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Text
                        className="text-text font-inter-bold"
                        style={{ fontSize: Spacing[4] }}
                      >
                        {formatCurrency(product.price)}
                      </Text>
                      <Text
                        style={{
                          color: status.color,
                          fontSize: Spacing[3],
                          marginLeft: 8,
                        }}
                        className="font-inter"
                      >
                        {product.stock} in stock
                      </Text>
                    </View>
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
                          placeholder="Name"
                          placeholderTextColor={Colors.textMuted}
                          style={editInputStyle}
                        />
                        <TextInput
                          value={editDraft.sku}
                          onChangeText={(t) =>
                            setEditDraft((d) => ({ ...d, sku: t }))
                          }
                          placeholder="SKU"
                          placeholderTextColor={Colors.textMuted}
                          autoCapitalize="characters"
                          style={editInputStyle}
                        />
                        <TextInput
                          value={editDraft.category}
                          onChangeText={(t) =>
                            setEditDraft((d) => ({ ...d, category: t }))
                          }
                          placeholder="Category"
                          placeholderTextColor={Colors.textMuted}
                          style={editInputStyle}
                        />
                        <TextInput
                          value={String(editDraft.price ?? "")}
                          onChangeText={(t) =>
                            setEditDraft((d) => ({ ...d, price: t }))
                          }
                          placeholder="Price"
                          placeholderTextColor={Colors.textMuted}
                          keyboardType="decimal-pad"
                          style={editInputStyle}
                        />
                        <TextInput
                          value={String(editDraft.stock ?? "")}
                          onChangeText={(t) =>
                            setEditDraft((d) => ({
                              ...d,
                              stock: t as unknown as number,
                            }))
                          }
                          placeholder="Stock"
                          placeholderTextColor={Colors.textMuted}
                          keyboardType="number-pad"
                          style={editInputStyle}
                        />

                        <View className="flex-row gap-3 mt-2">
                          <TouchableOpacity
                            disabled={savingEdit}
                            onPress={(e: any) => {
                              e.stopPropagation?.();
                              saveEdit(product.id);
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
                      <View className="flex-row gap-3">
                        <TouchableOpacity
                          onPress={(e: any) => {
                            e.stopPropagation?.();
                            startEdit(product);
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
                            handleDelete(product.id);
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
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Add Product Modal */}
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
              Add Product
            </Text>

            <TextInput
              value={newProduct.name}
              onChangeText={(t) => setNewProduct((p) => ({ ...p, name: t }))}
              placeholder="Product name"
              placeholderTextColor={Colors.textMuted}
              style={editInputStyle}
            />
            <TextInput
              value={newProduct.sku}
              onChangeText={(t) => setNewProduct((p) => ({ ...p, sku: t }))}
              placeholder="SKU"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              style={editInputStyle}
            />
            <TextInput
              value={newProduct.category}
              onChangeText={(t) =>
                setNewProduct((p) => ({ ...p, category: t }))
              }
              placeholder="Category"
              placeholderTextColor={Colors.textMuted}
              style={editInputStyle}
            />
            <TextInput
              value={newProduct.price}
              onChangeText={(t) => setNewProduct((p) => ({ ...p, price: t }))}
              placeholder="Price"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              style={editInputStyle}
            />
            <TextInput
              value={newProduct.stock}
              onChangeText={(t) => setNewProduct((p) => ({ ...p, stock: t }))}
              placeholder="Stock quantity"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              style={editInputStyle}
            />

            <View className="flex-row gap-3 mt-3">
              <TouchableOpacity
                disabled={savingAdd}
                onPress={handleAddProduct}
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
                  {savingAdd ? "Adding..." : "Add Product"}
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

export default ProductsScreen;
