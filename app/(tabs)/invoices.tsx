import { auth, db } from "@/config/firebaseConfig";
import { icons } from "@/constants/icons";
import { Colors, Spacing } from "@/constants/theme";
import { generateAndShareInvoicePdf } from "@/lib/generateInvoicePdf";
import {
  validateNonNegativeNumber,
  validatePositiveInteger,
  validateRequiredText,
} from "@/lib/validation";
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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SearchIcon = icons.search;
const DownloadIcon = icons.download;
const MoreIcon = icons.moreVertical ?? icons.more;

const SafeAreaView = styled(RNSafeAreaView);

type InvoiceStatus = "paid" | "pending" | "overdue" | "draft" | "partial";
type InvoiceType = "sales" | "purchase";

type InvoiceItem = {
  query: string; // whatever the user typed (SKU or name)
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  matched: boolean; // false if product had to be auto-created
};

type Invoice = {
  id: string;
  client: string;
  invoiceNumber: string;
  date: string;
  amount: number;
  amountPaid?: number;
  status: InvoiceStatus;
  type?: InvoiceType;
  customerId?: string;
  customerName?: string;
  items?: InvoiceItem[];
  subtotal?: number;
  discount?: number;
};

type Product = {
  id: string;
  sku?: string;
  name?: string;
  price?: number | string | null;
  stock?: number | string | null;
};

type Customer = {
  id: string;
  name: string;
};

type InvoiceItemDraft = {
  id: string;
  queryText: string;
  quantity: string;
  price: string; // optional manual override — empty string = use DB price
};

const STATUS_META: Record<
  InvoiceStatus,
  {
    label: string;
    color: string;
    bg: string;
  }
> = {
  paid: {
    label: "Paid",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.15)",
  },
  pending: {
    label: "Pending",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.15)",
  },
  overdue: {
    label: "Overdue",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.15)",
  },
  draft: {
    label: "Draft",
    color: "#9ca3af",
    bg: "rgba(156,163,175,0.15)",
  },
  partial: {
    label: "Partial",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.15)",
  },
};

const STATUS_TABS: { key: "all" | InvoiceStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "pending", label: "Pending" },
  { key: "partial", label: "Partial" },
  { key: "overdue", label: "Overdue" },
  { key: "draft", label: "Draft" },
];

// ---- Pakistani Rupee formatting (Rs. 1,23,456.00 style) ----
const formatPKR = (amount: number | null | undefined) => {
  const value = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  const isNegative = value < 0;
  const fixed = Math.abs(value).toFixed(2);
  const [intPart, decPart] = fixed.split(".");

  let lastThree = intPart.slice(-3);
  const otherNumbers = intPart.slice(0, -3);
  if (otherNumbers !== "") {
    lastThree = "," + lastThree;
  }
  const formattedInt =
    otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;

  return `Rs. ${isNegative ? "-" : ""}${formattedInt}.${decPart}`;
};

const getPKRParts = (amount: number | null | undefined) => {
  const formatted = formatPKR(amount);
  return {
    currency: "Rs.",
    value: formatted.replace(/^Rs\.\s*/, ""),
  };
};

const normalize = (s: string) => s.trim().toLowerCase();

const findProductMatch = (products: Product[], q: string) => {
  const nq = normalize(q);
  return products.find(
    (p) =>
      (p.sku && normalize(p.sku) === nq) ||
      (p.name && normalize(p.name) === nq),
  );
};

// Returns how much of an invoice has actually been paid so far,
// falling back gracefully for invoices created before partial payments existed.
const getAmountPaid = (invoice: Invoice) =>
  invoice.amountPaid ?? (invoice.status === "paid" ? invoice.amount : 0);

const getBalanceDue = (invoice: Invoice) =>
  Math.max(0, invoice.amount - getAmountPaid(invoice));

const getSignedAmount = (invoice: Invoice, amount: number) =>
  invoice.type === "purchase" ? -Math.abs(amount) : Math.abs(amount);

let draftIdCounter = 1;
const nextDraftId = () => String(draftIdCounter++);

const InvoicesScreen = () => {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | InvoiceStatus>("all");

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Invoice>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [chooseTypeVisible, setChooseTypeVisible] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    client: "",
    invoiceNumber: "",
    date: "",
    status: "pending" as InvoiceStatus,
    discount: "",
  });
  const [itemDrafts, setItemDrafts] = useState<InvoiceItemDraft[]>([
    { id: nextDraftId(), queryText: "", quantity: "1", price: "" },
  ]);

  // Item-level editing for an EXISTING invoice — separate from itemDrafts
  // (which is only for creating a brand-new invoice). Populated from the
  // invoice's own items when Edit is tapped.
  const [editItemDrafts, setEditItemDrafts] = useState<InvoiceItemDraft[]>([]);
  const [newPurchaseInvoice, setNewPurchaseInvoice] = useState({
    vendor: "",
    invoiceNumber: "",
    date: "",
    amount: "",
    status: "pending" as InvoiceStatus,
  });

  // Partial payment modal
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentAmountText, setPaymentAmountText] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  // Organization details for the PDF header
  const [orgName, setOrgName] = useState<string>("");
  const [orgEmail, setOrgEmail] = useState<string>("");
  const [orgPhone, setOrgPhone] = useState<string>("");
  const [orgCell, setOrgCell] = useState<string>("");
  const [orgAddress, setOrgAddress] = useState<string>("");
  const [orgNtn, setOrgNtn] = useState<string>("");
  const [orgSalesTaxNo, setOrgSalesTaxNo] = useState<string>("");
  const [orgId, setOrgId] = useState<string>("");

  // The signed-in user's own name — used only for the invoice's
  // single-creator signature block (System.User.Name).
  const [signedInUserName, setSignedInUserName] = useState<string>("");

  // Fetch the current user's org info
  React.useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsubscribe = onSnapshot(doc(db, "users", uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setOrgName(data.orgName ?? "");
        setOrgEmail(data.orgEmail ?? "");
        setOrgPhone(data.orgPhone ?? "");
        setOrgCell(data.orgCell ?? "");
        setOrgAddress(data.orgAddress ?? "");
        setOrgNtn(data.orgNtn ?? "");
        setOrgSalesTaxNo(data.orgSalesTaxNo ?? "");
        setOrgId(data.orgId ?? "");
        setSignedInUserName(data.name ?? auth.currentUser?.displayName ?? "");
      }
    });

    return unsubscribe;
  }, []);

  // Real-time Firestore listener for invoices
  React.useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "invoices"),
      where("orgId", "==", orgId),
      orderBy("date", "desc"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Invoice, "id">),
        }));
        setInvoices(data);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore listener error:", error);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [orgId]);

  // Real-time Firestore listener for products (used for price/stock lookups)
  React.useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, "products"), where("orgId", "==", orgId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Product, "id">),
        }));
        setProducts(data);
      },
      (error) => {
        console.error("Products listener error:", error);
      },
    );
    return () => unsubscribe();
  }, [orgId]);

  // Real-time customers listener used to attach invoices to known customers.
  React.useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, "customers"), where("orgId", "==", orgId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Customer, "id">),
        }));
        setCustomers(data);
      },
      (error) => {
        console.error("Customers listener error (invoices screen):", error);
      },
    );
    return () => unsubscribe();
  }, [orgId]);

  const filteredInvoices = useMemo(() => {
    let list = invoices;
    if (activeTab !== "all") {
      list = list.filter((inv) => inv.status === activeTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (inv) =>
          inv.client.toLowerCase().includes(q) ||
          inv.invoiceNumber.toLowerCase().includes(q),
      );
    }
    return list;
  }, [invoices, activeTab, search]);

  // Stats now use balance due (not the full invoice amount) for anything still
  // outstanding, so a partially-paid invoice doesn't overstate what's owed.
  const stats = useMemo(() => {
    const totalDue = invoices
      .filter(
        (inv) =>
          (inv.type ?? "sales") !== "purchase" &&
          (inv.status === "pending" ||
            inv.status === "overdue" ||
            inv.status === "partial"),
      )
      .reduce((sum, inv) => sum + getBalanceDue(inv), 0);
    const overdue = invoices
      .filter(
        (inv) =>
          (inv.type ?? "sales") === "purchase" &&
          (inv.status === "pending" ||
            inv.status === "overdue" ||
            inv.status === "partial"),
      )
      .reduce((sum, inv) => sum + getBalanceDue(inv), 0);
    const collected = invoices.reduce(
      (sum, inv) => sum + getSignedAmount(inv, getAmountPaid(inv)),
      0,
    );
    return { totalDue, overdue, collected };
  }, [invoices]);

  // ---- Item draft helpers (Add Invoice modal) ----
  const addItemRow = () => {
    setItemDrafts((rows) => [
      ...rows,
      { id: nextDraftId(), queryText: "", quantity: "1", price: "" },
    ]);
  };

  const removeItemRow = (id: string) => {
    setItemDrafts((rows) =>
      rows.length === 1 ? rows : rows.filter((r) => r.id !== id),
    );
  };

  const updateItemRow = (id: string, patch: Partial<InvoiceItemDraft>) => {
    setItemDrafts((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  };

  const resetItemDrafts = () => {
    setItemDrafts([
      { id: nextDraftId(), queryText: "", quantity: "1", price: "" },
    ]);
  };

  const resetAddModal = () => {
    setNewInvoice({
      client: "",
      invoiceNumber: "",
      date: "",
      status: "pending",
      discount: "",
    });
    resetItemDrafts();
  };

  // ---- Item draft helpers (Edit Invoice — existing invoice's items) ----
  const addEditItemRow = () => {
    setEditItemDrafts((rows) => [
      ...rows,
      { id: nextDraftId(), queryText: "", quantity: "1", price: "" },
    ]);
  };

  const removeEditItemRow = (id: string) => {
    setEditItemDrafts((rows) =>
      rows.length === 1 ? rows : rows.filter((r) => r.id !== id),
    );
  };

  const updateEditItemRow = (id: string, patch: Partial<InvoiceItemDraft>) => {
    setEditItemDrafts((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  };

  // Undoes the stock effect of an invoice's ORIGINAL items before applying
  // the edited set — otherwise stock would be deducted twice (once when the
  // invoice was first created, again when the edit re-processes the items).
  const reverseItemStockEffects = async (
    items: InvoiceItem[] | undefined,
    invoiceType: InvoiceType,
  ) => {
    if (!items || items.length === 0) return;
    const isPurchase = invoiceType === "purchase";

    for (const item of items) {
      const match = findProductMatch(
        products,
        item.sku || item.name || item.query,
      );
      if (match && match.stock !== null && match.stock !== undefined) {
        const currentStock = Number(match.stock) || 0;
        // Reverse of what processInvoiceItems originally did:
        // sales invoices deducted stock -> add it back
        // purchase invoices added stock -> take it back off
        const restoredStock = isPurchase
          ? Math.max(0, currentStock - item.quantity)
          : currentStock + item.quantity;
        try {
          await updateDoc(doc(db, "products", match.id), {
            stock: restoredStock,
          });
        } catch (error) {
          console.error("Error reversing stock for edited invoice:", error);
        }
      }
    }
  };

  // Saves item-level edits (quantity/price/add/remove) for an EXISTING
  // invoice. Reverses the old stock impact first, then re-applies the new
  // item list exactly the way invoice creation does, so stock stays correct.
  const saveInvoiceItemEdits = async (invoice: Invoice) => {
    if (!validateInvoiceDraftRows(editItemDrafts)) return;

    const hasAtLeastOneItem = editItemDrafts.some((d) => d.queryText.trim());
    if (!hasAtLeastOneItem) {
      Alert.alert("No items", "Add at least one product with a quantity.");
      return;
    }

    setSavingEdit(true);
    try {
      const invoiceType = invoice.type ?? "sales";
      await reverseItemStockEffects(invoice.items, invoiceType);
      const { items, total } = await processInvoiceItems(editItemDrafts, {
        invoiceType,
      });

      const discountAmount = Number(editDraft.discount) || 0;
      const finalTotal = Math.max(0, total - discountAmount);

      await updateDoc(doc(db, "invoices", invoice.id), {
        client: (editDraft.client ?? invoice.client).trim(),
        invoiceNumber: (
          editDraft.invoiceNumber ?? invoice.invoiceNumber
        ).trim(),
        date: editDraft.date ?? invoice.date,
        status: editDraft.status ?? invoice.status,
        items,
        subtotal: total,
        discount: discountAmount,
        amount: finalTotal,
      });

      setEditId(null);
      setEditDraft({});
      setEditItemDrafts([]);
    } catch (error) {
      console.error("Error saving invoice item edits:", error);
      Alert.alert("Error", "Could not save item changes. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const resetPurchaseModal = () => {
    setNewPurchaseInvoice({
      vendor: "",
      invoiceNumber: "",
      date: "",
      amount: "",
      status: "pending",
    });
    resetItemDrafts();
  };

  const openNewInvoicePicker = () => {
    setChooseTypeVisible(true);
  };

  const resolveCustomerLink = (clientName: string) => {
    const normalizedClient = normalize(clientName);
    const matched = customers.find(
      (c) => normalize(c.name) === normalizedClient,
    );
    return {
      customerId: matched?.id,
      customerName: matched?.name,
    };
  };

  const validateInvoiceDraftRows = (drafts: InvoiceItemDraft[]) => {
    for (const draft of drafts) {
      const rawQuery = draft.queryText.trim();
      if (!rawQuery) continue;

      if (!validatePositiveInteger(draft.quantity)) {
        Alert.alert(
          "Invalid quantity",
          "Each item quantity must be a whole number greater than zero.",
        );
        return false;
      }

      if (draft.price.trim() && !validateNonNegativeNumber(draft.price)) {
        Alert.alert(
          "Invalid price",
          "Price must be a valid non-negative number.",
        );
        return false;
      }
    }

    return true;
  };

  // Resolves each drafted row against the products collection:
  // - sales invoice: uses existing product price, decrements stock, never overwrites price
  // - purchase invoice: uses existing product price, increments stock, can update price when entered
  // - no match -> auto-creates the product (sku + name = whatever was typed),
  //   leaves price/stock at 0 until filled in
  const processInvoiceItems = async (
    drafts: InvoiceItemDraft[],
    options?: { invoiceType?: InvoiceType },
  ): Promise<{ items: InvoiceItem[]; total: number }> => {
    const items: InvoiceItem[] = [];
    let total = 0;
    const invoiceType = options?.invoiceType ?? "sales";
    const isPurchase = invoiceType === "purchase";

    for (const draft of drafts) {
      const rawQuery = draft.queryText.trim();
      if (!rawQuery) continue;

      const quantity = Number(draft.quantity) || 1;
      const manualPriceText = draft.price.trim();
      const parsedManualPrice = manualPriceText
        ? parseFloat(manualPriceText)
        : NaN;
      const hasManualPrice =
        manualPriceText !== "" &&
        !isNaN(parsedManualPrice) &&
        parsedManualPrice >= 0;

      const match = findProductMatch(products, rawQuery);

      if (match) {
        const dbPrice = Number(match.price ?? 0);
        const unitPrice = hasManualPrice ? parsedManualPrice : dbPrice;
        const lineTotal = quantity * unitPrice;

        const productUpdates: Record<string, string | number> = {};

        if (match.stock !== null && match.stock !== undefined) {
          const currentStock = Number(match.stock) || 0;
          productUpdates.stock = isPurchase
            ? currentStock + quantity
            : Math.max(0, currentStock - quantity);
        }

        if (isPurchase && hasManualPrice && unitPrice !== dbPrice) {
          productUpdates.price = unitPrice;
        }

        if (Object.keys(productUpdates).length > 0) {
          try {
            await updateDoc(doc(db, "products", match.id), productUpdates);
          } catch (error) {
            console.error("Error updating product:", error);
          }
        }

        items.push({
          query: rawQuery,
          sku: match.sku ?? rawQuery,
          name: match.name ?? rawQuery,
          quantity,
          unitPrice,
          lineTotal,
          matched: true,
        });

        total += lineTotal;
      } else {
        // Product not found -> create it automatically, scoped to this org.
        // Use the manual price if given, otherwise fall back to 0.
        const unitPrice = hasManualPrice ? parsedManualPrice : 0;
        const lineTotal = quantity * unitPrice;

        try {
          await addDoc(collection(db, "products"), {
            orgId,
            sku: rawQuery,
            name: rawQuery,
            price: String(unitPrice),
            stock: isPurchase ? quantity : 0,
            createdAt: Date.now(),
          });
        } catch (error) {
          console.error("Error auto-creating product:", error);
        }

        items.push({
          query: rawQuery,
          sku: rawQuery,
          name: rawQuery,
          quantity,
          unitPrice,
          lineTotal,
          matched: false,
        });

        total += lineTotal;
      }
    }

    return {
      items,
      total,
    };
  };

  const handleAddInvoice = async () => {
    if (
      !validateRequiredText(newInvoice.client) ||
      !validateRequiredText(newInvoice.invoiceNumber)
    ) {
      Alert.alert("Missing info", "Client and invoice number are required.");
      return;
    }

    const hasAtLeastOneItem = itemDrafts.some((d) => d.queryText.trim());
    if (!hasAtLeastOneItem) {
      Alert.alert(
        "No products added",
        "Add at least one product (SKU or name) with a quantity.",
      );
      return;
    }

    if (!validateInvoiceDraftRows(itemDrafts)) {
      return;
    }

    setSavingAdd(true);
    try {
      const { items, total } = await processInvoiceItems(itemDrafts, {
        invoiceType: "sales",
      });
      const discountAmount = Math.max(0, parseFloat(newInvoice.discount) || 0);
      const finalTotal = Math.max(0, total - discountAmount);
      const normalizedStatus: InvoiceStatus =
        newInvoice.status === "paid" ? "paid" : newInvoice.status;
      const initialAmountPaid = normalizedStatus === "paid" ? finalTotal : 0;
      const customerLink = resolveCustomerLink(newInvoice.client.trim());

      await addDoc(collection(db, "invoices"), {
        orgId,
        client: newInvoice.client.trim(),
        invoiceNumber: newInvoice.invoiceNumber.trim(),
        date: newInvoice.date.trim() || new Date().toISOString().slice(0, 10),
        subtotal: total,
        discount: discountAmount,
        amount: finalTotal,
        amountPaid: initialAmountPaid,
        status: normalizedStatus,
        type: "sales",
        customerId: customerLink.customerId ?? null,
        customerName: customerLink.customerName ?? null,
        items,
        createdAt: Date.now(),
      });

      // Paid-at-creation sales invoices must immediately affect revenue metrics.
      if (normalizedStatus === "paid" && finalTotal > 0) {
        await addDoc(collection(db, "sales"), {
          orgId,
          amount: Math.abs(finalTotal),
          client: newInvoice.client.trim(),
          invoiceNumber: newInvoice.invoiceNumber.trim(),
          type: "invoice_payment",
          createdAt: Date.now(),
        });
      }

      resetAddModal();
      setAddModalVisible(false);
    } catch (error) {
      console.error("Error adding invoice:", error);
      Alert.alert("Error", "Could not add invoice. Please try again.");
    } finally {
      setSavingAdd(false);
    }
  };

  const handleAddPurchaseInvoice = async () => {
    if (
      !newPurchaseInvoice.vendor.trim() ||
      !newPurchaseInvoice.invoiceNumber.trim()
    ) {
      Alert.alert("Missing info", "Vendor and invoice number are required.");
      return;
    }

    const hasAtLeastOneItem = itemDrafts.some((d) => d.queryText.trim());
    if (!hasAtLeastOneItem) {
      Alert.alert(
        "No products added",
        "Add at least one item name, price, and quantity.",
      );
      return;
    }

    if (!validateInvoiceDraftRows(itemDrafts)) {
      return;
    }

    setSavingAdd(true);
    try {
      const { items, total } = await processInvoiceItems(itemDrafts, {
        invoiceType: "purchase",
      });
      const normalizedStatus: InvoiceStatus =
        newPurchaseInvoice.status === "paid"
          ? "paid"
          : newPurchaseInvoice.status;
      const initialAmountPaid = normalizedStatus === "paid" ? total : 0;

      await addDoc(collection(db, "invoices"), {
        orgId,
        client: newPurchaseInvoice.vendor.trim(),
        invoiceNumber: newPurchaseInvoice.invoiceNumber.trim(),
        date:
          newPurchaseInvoice.date.trim() ||
          new Date().toISOString().slice(0, 10),
        amount: total,
        amountPaid: initialAmountPaid,
        status: normalizedStatus,
        type: "purchase",
        items,
        createdAt: Date.now(),
      });

      // Paid purchase invoices are expenses and should reduce net revenue.
      if (normalizedStatus === "paid" && total > 0) {
        await addDoc(collection(db, "sales"), {
          orgId,
          amount: -Math.abs(total),
          client: newPurchaseInvoice.vendor.trim(),
          invoiceNumber: newPurchaseInvoice.invoiceNumber.trim(),
          type: "purchase_payment",
          createdAt: Date.now(),
        });
      }

      resetPurchaseModal();
      setPurchaseModalVisible(false);
    } catch (error) {
      console.error("Error adding purchase invoice:", error);
      Alert.alert("Error", "Could not add purchase invoice. Please try again.");
    } finally {
      setSavingAdd(false);
    }
  };

  const startEdit = (invoice: Invoice) => {
    setEditId(invoice.id);
    setEditDraft({ ...invoice, discount: invoice.discount ?? 0 });

    if (invoice.items && invoice.items.length > 0) {
      setEditItemDrafts(
        invoice.items.map((item) => ({
          id: nextDraftId(),
          queryText: item.query || item.name || item.sku,
          quantity: String(item.quantity),
          price: String(item.unitPrice),
        })),
      );
    } else {
      setEditItemDrafts([]);
    }
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditDraft({});
    setEditItemDrafts([]);
  };

  const saveEdit = async (id: string) => {
    const draftClient = editDraft.client ?? "";
    const draftInvoiceNumber = editDraft.invoiceNumber ?? "";
    const draftAmount = String(editDraft.amount ?? "");
    const draftDate = editDraft.date ?? "";

    if (
      !validateRequiredText(draftClient) ||
      !validateRequiredText(draftInvoiceNumber)
    ) {
      Alert.alert("Missing info", "Client and invoice number are required.");
      return;
    }
    if (draftAmount.trim() && !validateNonNegativeNumber(draftAmount)) {
      Alert.alert("Invalid amount", "Enter a valid non-negative amount.");
      return;
    }

    setSavingEdit(true);
    try {
      const customerLink = resolveCustomerLink(draftClient.trim());
      await updateDoc(doc(db, "invoices", id), {
        client: draftClient.trim(),
        invoiceNumber: draftInvoiceNumber.trim(),
        date: draftDate.trim(),
        amount: draftAmount.trim() ? parseFloat(draftAmount) || 0 : 0,
        status: editDraft.status ?? "pending",
        customerId: customerLink.customerId ?? null,
        customerName: customerLink.customerName ?? null,
      });
      setEditId(null);
      setEditDraft({});
    } catch (error) {
      console.error("Error updating invoice:", error);
      Alert.alert("Error", "Could not save changes. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete invoice", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "invoices", id));
          } catch (error) {
            console.error("Error deleting invoice:", error);
          }
        },
      },
    ]);
  };

  // One-tap: settles whatever balance remains on the invoice in a single payment.
  const markPaid = async (invoice: Invoice) => {
    const balance = getBalanceDue(invoice);
    if (balance <= 0) return;

    try {
      await updateDoc(doc(db, "invoices", invoice.id), {
        amountPaid: invoice.amount,
        status: "paid",
      });
      await addDoc(collection(db, "sales"), {
        orgId,
        amount: getSignedAmount(invoice, balance),
        invoiceId: invoice.id,
        client: invoice.client,
        invoiceNumber: invoice.invoiceNumber,
        type:
          invoice.type === "purchase" ? "purchase_payment" : "invoice_payment",
        createdAt: Date.now(),
      });
    } catch (error) {
      console.error("Error marking invoice paid:", error);
      Alert.alert("Error", "Could not update invoice. Please try again.");
    }
  };

  const openPaymentModal = (invoice: Invoice) => {
    setPaymentInvoice(invoice);
    setPaymentAmountText("");
    setPaymentModalVisible(true);
  };

  const closePaymentModal = () => {
    setPaymentModalVisible(false);
    setPaymentInvoice(null);
    setPaymentAmountText("");
  };

  // Records a partial (or full) payment against an invoice: reduces the
  // balance due, flips status to "partial" or "paid" as appropriate, and logs
  // a real sale so the dashboard/revenue graph reflect money actually collected.
  const handleRecordPayment = async () => {
    if (!paymentInvoice) return;

    const amountPaidSoFar = getAmountPaid(paymentInvoice);
    const balanceDue = paymentInvoice.amount - amountPaidSoFar;
    const payment = parseFloat(paymentAmountText);

    if (!payment || payment <= 0) {
      Alert.alert(
        "Invalid amount",
        "Enter a payment amount greater than zero.",
      );
      return;
    }
    if (payment > balanceDue + 0.01) {
      Alert.alert(
        "Amount too high",
        `This invoice only has ${formatPKR(balanceDue)} remaining.`,
      );
      return;
    }

    setSavingPayment(true);
    try {
      const newAmountPaid = amountPaidSoFar + payment;
      const newStatus: InvoiceStatus =
        newAmountPaid >= paymentInvoice.amount - 0.01 ? "paid" : "partial";

      await updateDoc(doc(db, "invoices", paymentInvoice.id), {
        amountPaid: newAmountPaid,
        status: newStatus,
      });

      await addDoc(collection(db, "sales"), {
        orgId,
        amount: getSignedAmount(paymentInvoice, payment),
        invoiceId: paymentInvoice.id,
        client: paymentInvoice.client,
        invoiceNumber: paymentInvoice.invoiceNumber,
        type:
          paymentInvoice.type === "purchase"
            ? "purchase_payment"
            : "invoice_payment",
        createdAt: Date.now(),
      });

      closePaymentModal();
    } catch (error) {
      console.error("Error recording payment:", error);
      Alert.alert("Error", "Could not record payment. Please try again.");
    } finally {
      setSavingPayment(false);
    }
  };

  const toggleExpand = (id: string) => {
    if (editId && editId !== id) cancelEdit();
    setExpandedId(expandedId === id ? null : id);
  };

  const handleDownload = async (invoice: Invoice) => {
    try {
      const amountPaid = getAmountPaid(invoice);
      const balanceDue = getBalanceDue(invoice);
      await generateAndShareInvoicePdf({
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        client: invoice.client,
        amount: invoice.amount,
        items: invoice.items,
        status: invoice.status,
        invoiceType: invoice.type ?? "sales",
        amountPaid,
        balanceDue,
        discount: invoice.discount,
        orgName: orgName || "Your Business",
        orgEmail: orgEmail || undefined,
        orgPhone: orgPhone || undefined,
        orgCell: orgCell || undefined,
        orgAddress: orgAddress || undefined,
        orgNtn: orgNtn || undefined,
        orgSalesTaxNo: orgSalesTaxNo || undefined,
        preparedByName:
          signedInUserName || auth.currentUser?.email || undefined,
      });
    } catch (error) {
      console.error("PDF generation failed:", error);
      Alert.alert("Error", "Could not generate the invoice PDF.");
    }
  };

  const totalDueParts = getPKRParts(stats.totalDue);
  const overdueParts = getPKRParts(stats.overdue);
  const collectedParts = getPKRParts(stats.collected);

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
              Invoices
            </Text>
          </View>
          <View className="ml-3 flex-row items-center">
            <TouchableOpacity
              onPress={openNewInvoicePicker}
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
                + New Invoice
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Search */}
      <View
        className="search-container"
        style={{ flexDirection: "row", alignItems: "center" }}
      >
        <SearchIcon
          color={Colors.textMuted}
          size={Spacing[5]}
          style={{ marginRight: Spacing[2], flexShrink: 0 }}
        />
        <TextInput
          placeholder="Search invoices..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          style={{
            flex: 1,
            fontSize: Spacing[4],
            color: Colors.text,
            paddingVertical: 0,
          }}
        />
      </View>

      {/* Stats */}
      <View>
        <View className="flex-row gap-3">
          <View className="home-balance-card">
            <View className="items-center">
              <View className="flex-row items-end">
                <Text
                  style={{
                    fontSize: Spacing[3],
                    lineHeight: 16,
                    marginRight: 4,
                  }}
                  className="text-yellow-300 font-inter-bold"
                >
                  {totalDueParts.currency}
                </Text>
                <Text
                  style={{ fontSize: Spacing[4.5], lineHeight: 24 }}
                  className="text-yellow-300 font-inter-bold"
                >
                  {totalDueParts.value}
                </Text>
              </View>
              <Text
                style={{ fontSize: Spacing[3] }}
                className="text-text-muted"
              >
                Total Due
              </Text>
            </View>
          </View>
          <View className="home-balance-card">
            <View className="items-center">
              <View className="items-center">
                <Text
                  style={{
                    fontSize: Spacing[3],
                    lineHeight: 16,
                  }}
                  className="font-inter-bold text-red-800"
                >
                  {overdueParts.currency}
                </Text>
                <Text
                  style={{ fontSize: Spacing[4.5], lineHeight: 24 }}
                  className="font-inter-bold text-red-800"
                >
                  {overdueParts.value}
                </Text>
              </View>
              <Text
                style={{ fontSize: Spacing[3] }}
                className="text-text-muted"
              >
                Purchase Due
              </Text>
            </View>
          </View>
          <View className="home-balance-card">
            <View className="items-center">
              <View className="flex-row items-end">
                <Text
                  style={{
                    fontSize: Spacing[3],
                    lineHeight: 16,
                    marginRight: 4,
                  }}
                  className="font-inter-bold text-green-400"
                >
                  {collectedParts.currency}
                </Text>
                <Text
                  style={{ fontSize: Spacing[4.5], lineHeight: 24 }}
                  className="font-inter-bold text-green-400"
                >
                  {collectedParts.value}
                </Text>
              </View>
              <Text
                style={{ fontSize: Spacing[3] }}
                className="text-text-muted"
              >
                Collected
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/*
        Filter tabs
        Previously these only got sizing from a `className="list-action"`
        that wasn't guaranteed to apply, plus a StyleSheet that set nothing
        but backgroundColor. With no real padding landing on the Pressable,
        every tab shrank to bare text with no spacing, so the whole row
        collapsed into a tight cluster instead of a row of pill buttons.
        Padding/border-radius/text color are now set directly inline so
        they always apply, on every platform.
      */}
      <View className="flex-row flex-wrap items-center mt-5" style={{ gap: 8 }}>
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                {
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: 1,
                },
                isActive ? styles.buttonActive : styles.buttonInactive,
              ]}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: isActive ? Colors.text : Colors.textMuted,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Invoice list / empty state */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 10 }}
        className="mt-4 mb-14"
      >
        {loading ? (
          <View className="items-center justify-center py-20">
            <Text className="text-text-muted font-inter">
              Loading invoices...
            </Text>
          </View>
        ) : filteredInvoices.length === 0 ? (
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
              <Text style={{ fontSize: 28 }}>🧾</Text>
            </View>
            <Text
              className="text-text font-inter-bold"
              style={{ fontSize: Spacing[5] }}
            >
              No invoices yet
            </Text>
            <Text className="text-text-muted font-inter mt-1">
              Tap "+ New Invoice" to create your first invoice
            </Text>
          </View>
        ) : (
          filteredInvoices.map((invoice) => {
            const meta = STATUS_META[invoice.status] ?? STATUS_META.draft;
            const isExpanded = expandedId === invoice.id;
            const isEditing = editId === invoice.id;
            const balanceDue = getBalanceDue(invoice);
            const amountPaid = getAmountPaid(invoice);
            const canTakePayment =
              invoice.status === "pending" ||
              invoice.status === "overdue" ||
              invoice.status === "partial";

            return (
              <View
                key={invoice.id}
                style={{
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.1)",
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                {/* Top row — only this part toggles expand/collapse now.
                    Previously the WHOLE card was one TouchableOpacity, so
                    every button inside it (Edit, Delete, Save...) had to
                    stopPropagation() to avoid also re-triggering the card's
                    own toggle. That works reliably on native mobile, but on
                    web a click's propagation doesn't always get stopped the
                    same way — so tapping Edit would open edit mode AND
                    immediately re-collapse the card, making editing look
                    broken. Isolating the tap target to just the header
                    removes the conflict entirely, on every platform. */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => toggleExpand(invoice.id)}
                >
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text
                        className="text-text font-inter-bold"
                        style={{ fontSize: Spacing[4] }}
                      >
                        {invoice.client}
                      </Text>

                      <Text
                        className="text-text-muted font-inter"
                        style={{ fontSize: Spacing[3] }}
                      >
                        {invoice.invoiceNumber} · {invoice.date} ·{" "}
                        {(invoice.type ?? "sales").toUpperCase()}
                      </Text>
                    </View>

                    <View
                      style={{
                        backgroundColor: meta.bg,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 20,
                      }}
                    >
                      <Text
                        style={{
                          color: meta.color,
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        {meta.label}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Divider */}
                <View
                  style={{
                    height: 1,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    marginVertical: 12,
                  }}
                />

                {/* Amount + balance due */}
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text
                      className="text-text font-inter-bold"
                      style={{ fontSize: Spacing[6] }}
                    >
                      {formatPKR(invoice.amount)}
                    </Text>
                    {amountPaid > 0 && invoice.status !== "paid" && (
                      <Text
                        className="font-inter"
                        style={{ fontSize: 12, color: "#3b82f6", marginTop: 2 }}
                      >
                        {formatPKR(amountPaid)} paid · {formatPKR(balanceDue)}{" "}
                        due
                      </Text>
                    )}
                  </View>

                  <View className="flex-row items-center gap-2">
                    <TouchableOpacity
                      onPress={(e: any) => {
                        e.stopPropagation?.();
                        handleDownload(invoice);
                      }}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: "rgba(255,255,255,0.08)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {DownloadIcon ? (
                        <DownloadIcon
                          color={Colors.text}
                          width={16}
                          height={16}
                        />
                      ) : (
                        <Text className="text-text">⬇</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={(e: any) => {
                        e.stopPropagation?.();
                        toggleExpand(invoice.id);
                      }}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: "rgba(255,255,255,0.08)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {MoreIcon ? (
                        <MoreIcon color={Colors.text} width={16} height={16} />
                      ) : (
                        <Text className="text-text">⋮</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Payment actions */}
                {canTakePayment && (
                  <View className="flex-row flex-wrap gap-2 mt-3">
                    <TouchableOpacity
                      onPress={(e: any) => {
                        e.stopPropagation?.();
                        openPaymentModal(invoice);
                      }}
                      style={{
                        flex: 1,
                        minWidth: 140,
                        backgroundColor: "rgba(59,130,246,0.15)",
                        borderRadius: 10,
                        paddingVertical: 9,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{ color: "#3b82f6", fontSize: 12 }}
                        className="font-inter-bold"
                      >
                        Record Payment
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={(e: any) => {
                        e.stopPropagation?.();
                        markPaid(invoice);
                      }}
                      style={{
                        flex: 1,
                        minWidth: 140,
                        backgroundColor: Colors.primary ?? "#4b7c59",
                        borderRadius: 10,
                        paddingVertical: 9,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        className="text-text font-inter-bold"
                        style={{ fontSize: 12 }}
                      >
                        Mark Paid
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

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
                    {/* Line items (read-only summary) */}
                    {invoice.items && invoice.items.length > 0 && (
                      <View style={{ marginBottom: 12 }}>
                        {invoice.items.map((item, idx) => (
                          <View
                            key={`${invoice.id}-item-${idx}`}
                            className="flex-row items-center justify-between"
                            style={{ marginBottom: 6 }}
                          >
                            <Text
                              className="text-text font-inter"
                              style={{ fontSize: 13 }}
                            >
                              {item.name} × {item.quantity}
                              {!item.matched ? "  (new product)" : ""}
                            </Text>
                            <Text
                              className="text-text-muted font-inter"
                              style={{ fontSize: 13 }}
                            >
                              {formatPKR(item.lineTotal)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {isEditing ? (
                      <View>
                        <TextInput
                          value={editDraft.client}
                          onChangeText={(t) =>
                            setEditDraft((d) => ({ ...d, client: t }))
                          }
                          placeholder="Client name"
                          placeholderTextColor={Colors.textMuted}
                          autoCorrect={false}
                          style={editInputStyle}
                        />
                        <TextInput
                          value={editDraft.invoiceNumber}
                          onChangeText={(t) =>
                            setEditDraft((d) => ({ ...d, invoiceNumber: t }))
                          }
                          placeholder="Invoice number"
                          placeholderTextColor={Colors.textMuted}
                          autoCorrect={false}
                          style={editInputStyle}
                        />
                        <TextInput
                          value={editDraft.date}
                          onChangeText={(t) =>
                            setEditDraft((d) => ({ ...d, date: t }))
                          }
                          placeholder="Date (e.g. Jul 10, 2024)"
                          placeholderTextColor={Colors.textMuted}
                          autoCorrect={false}
                          style={editInputStyle}
                        />

                        {editItemDrafts.length > 0 ? (
                          <View style={{ marginBottom: 4 }}>
                            <Text
                              className="text-text-muted font-inter"
                              style={{ fontSize: 12, marginBottom: 6 }}
                            >
                              Items
                            </Text>
                            {editItemDrafts.map((row) => (
                              <View
                                key={row.id}
                                className="flex-row items-center"
                                style={{ gap: 6, marginBottom: 8 }}
                              >
                                <TextInput
                                  value={row.queryText}
                                  onChangeText={(t) =>
                                    updateEditItemRow(row.id, {
                                      queryText: t,
                                    })
                                  }
                                  placeholder="Product SKU or name"
                                  placeholderTextColor={Colors.textMuted}
                                  autoCorrect={false}
                                  style={[
                                    editInputStyle,
                                    { flex: 2, marginBottom: 0 },
                                  ]}
                                />
                                <TextInput
                                  value={row.quantity}
                                  onChangeText={(t) =>
                                    updateEditItemRow(row.id, { quantity: t })
                                  }
                                  placeholder="Qty"
                                  placeholderTextColor={Colors.textMuted}
                                  keyboardType="number-pad"
                                  style={[
                                    editInputStyle,
                                    { width: 60, marginBottom: 0 },
                                  ]}
                                />
                                <TextInput
                                  value={row.price}
                                  onChangeText={(t) =>
                                    updateEditItemRow(row.id, { price: t })
                                  }
                                  placeholder="Price"
                                  placeholderTextColor={Colors.textMuted}
                                  keyboardType="decimal-pad"
                                  style={[
                                    editInputStyle,
                                    { width: 80, marginBottom: 0 },
                                  ]}
                                />
                                <TouchableOpacity
                                  onPress={(e: any) => {
                                    e.stopPropagation?.();
                                    removeEditItemRow(row.id);
                                  }}
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 8,
                                    backgroundColor: "rgba(239,68,68,0.15)",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: "#ef4444",
                                      fontWeight: "700",
                                    }}
                                  >
                                    ×
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            ))}

                            <TouchableOpacity
                              onPress={(e: any) => {
                                e.stopPropagation?.();
                                addEditItemRow();
                              }}
                              style={{
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.15)",
                                borderRadius: 10,
                                paddingVertical: 8,
                                alignItems: "center",
                                marginBottom: 10,
                              }}
                            >
                              <Text
                                className="text-text-muted font-inter-bold"
                                style={{ fontSize: 13 }}
                              >
                                + Add Item
                              </Text>
                            </TouchableOpacity>

                            <TextInput
                              value={String(editDraft.discount ?? "")}
                              onChangeText={(t) =>
                                setEditDraft((d) => ({
                                  ...d,
                                  discount: t as unknown as number,
                                }))
                              }
                              placeholder="Discount (Rs., optional)"
                              placeholderTextColor={Colors.textMuted}
                              keyboardType="decimal-pad"
                              style={editInputStyle}
                            />
                          </View>
                        ) : (
                          <TextInput
                            value={String(editDraft.amount ?? "")}
                            onChangeText={(t) =>
                              setEditDraft((d) => ({
                                ...d,
                                amount: t as unknown as number,
                              }))
                            }
                            placeholder="Amount"
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="decimal-pad"
                            autoCorrect={false}
                            style={editInputStyle}
                          />
                        )}

                        {/* Status chips */}
                        <View className="flex-row flex-wrap gap-2 mb-3">
                          {(Object.keys(STATUS_META) as InvoiceStatus[]).map(
                            (statusKey) => {
                              const active = editDraft.status === statusKey;
                              const chipMeta = STATUS_META[statusKey];
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
                                      ? chipMeta.bg
                                      : "rgba(255,255,255,0.05)",
                                    borderWidth: 1,
                                    borderColor: active
                                      ? chipMeta.color
                                      : "rgba(255,255,255,0.1)",
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: active
                                        ? chipMeta.color
                                        : Colors.textMuted,
                                      fontSize: 12,
                                      fontWeight: "600",
                                    }}
                                  >
                                    {chipMeta.label}
                                  </Text>
                                </TouchableOpacity>
                              );
                            },
                          )}
                        </View>

                        <View className="flex-row flex-wrap gap-3">
                          <TouchableOpacity
                            disabled={savingEdit}
                            onPress={(e: any) => {
                              e.stopPropagation?.();
                              if (editItemDrafts.length > 0) {
                                saveInvoiceItemEdits(invoice);
                              } else {
                                saveEdit(invoice.id);
                              }
                            }}
                            style={{
                              flex: 1,
                              minWidth: 120,
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
                              minWidth: 120,
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
                      <View className="flex-row flex-wrap gap-3">
                        <TouchableOpacity
                          onPress={(e: any) => {
                            e.stopPropagation?.();
                            startEdit(invoice);
                          }}
                          style={{
                            flex: 1,
                            minWidth: 120,
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
                            handleDelete(invoice.id);
                          }}
                          style={{
                            flex: 1,
                            minWidth: 120,
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
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Choose Invoice Type Modal — replaces the old Alert.alert picker,
          which silently did nothing on web since RN Web has no real
          Alert.alert implementation with custom buttons. */}
      <Modal visible={chooseTypeVisible} transparent animationType="fade">
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
              backgroundColor: Colors.background ?? "#111",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <Text
              className="text-text font-inter-bold"
              style={{ fontSize: Spacing[5], marginBottom: 14 }}
            >
              New Invoice
            </Text>
            <Text
              className="text-text-muted font-inter"
              style={{ fontSize: 13, marginBottom: 16 }}
            >
              What kind of invoice is this?
            </Text>

            <TouchableOpacity
              onPress={() => {
                setChooseTypeVisible(false);
                resetAddModal();
                setAddModalVisible(true);
              }}
              style={{
                backgroundColor: Colors.primary ?? "#4b7c59",
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <Text className="text-text font-inter-bold">
                Sales Invoice (money coming in)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setChooseTypeVisible(false);
                resetPurchaseModal();
                setPurchaseModalVisible(true);
              }}
              style={{
                backgroundColor: "rgba(245,158,11,0.15)",
                borderWidth: 1,
                borderColor: "#f59e0b",
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <Text style={{ color: "#f59e0b" }} className="font-inter-bold">
                Purchase Invoice (money going out)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setChooseTypeVisible(false)}
              style={{ paddingVertical: 10, alignItems: "center" }}
            >
              <Text className="text-text-muted">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* New Invoice Modal */}
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
              maxHeight: "88%",
            }}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text
                className="text-text font-inter-bold"
                style={{ fontSize: Spacing[5], marginBottom: 12 }}
              >
                New Invoice
              </Text>

              <TextInput
                value={newInvoice.client}
                onChangeText={(t) =>
                  setNewInvoice((p) => ({ ...p, client: t }))
                }
                placeholder="Client name"
                placeholderTextColor={Colors.textMuted}
                autoCorrect={false}
                style={editInputStyle}
              />
              <TextInput
                value={newInvoice.invoiceNumber}
                onChangeText={(t) =>
                  setNewInvoice((p) => ({ ...p, invoiceNumber: t }))
                }
                placeholder="Invoice number (e.g. INV-2024-004)"
                placeholderTextColor={Colors.textMuted}
                autoCorrect={false}
                style={editInputStyle}
              />
              <TextInput
                value={newInvoice.date}
                onChangeText={(t) => setNewInvoice((p) => ({ ...p, date: t }))}
                placeholder="Date (e.g. Jul 20, 2024)"
                placeholderTextColor={Colors.textMuted}
                autoCorrect={false}
                style={editInputStyle}
              />

              {/* Status chips */}
              <View className="flex-row flex-wrap gap-2 mb-3">
                {(Object.keys(STATUS_META) as InvoiceStatus[]).map(
                  (statusKey) => {
                    const active = newInvoice.status === statusKey;
                    const chipMeta = STATUS_META[statusKey];
                    return (
                      <TouchableOpacity
                        key={statusKey}
                        onPress={() =>
                          setNewInvoice((p) => ({ ...p, status: statusKey }))
                        }
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 20,
                          backgroundColor: active
                            ? chipMeta.bg
                            : "rgba(255,255,255,0.05)",
                          borderWidth: 1,
                          borderColor: active
                            ? chipMeta.color
                            : "rgba(255,255,255,0.1)",
                        }}
                      >
                        <Text
                          style={{
                            color: active ? chipMeta.color : Colors.textMuted,
                            fontSize: 12,
                            fontWeight: "600",
                          }}
                        >
                          {chipMeta.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  },
                )}
              </View>

              {/* Product line items */}
              <Text
                className="text-text font-inter-bold"
                style={{ fontSize: Spacing[4], marginBottom: 8 }}
              >
                Products
              </Text>

              {itemDrafts.map((row) => (
                <View
                  key={row.id}
                  className="flex-row items-center gap-2"
                  style={{ marginBottom: 10 }}
                >
                  <TextInput
                    value={row.queryText}
                    onChangeText={(t) =>
                      updateItemRow(row.id, { queryText: t })
                    }
                    placeholder="SKU or product name"
                    placeholderTextColor={Colors.textMuted}
                    autoCorrect={false}
                    style={[editInputStyle, { flex: 2, marginBottom: 0 }]}
                  />
                  <TextInput
                    value={row.quantity}
                    onChangeText={(t) => updateItemRow(row.id, { quantity: t })}
                    placeholder="Qty"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                    autoCorrect={false}
                    style={[editInputStyle, { flex: 1, marginBottom: 0 }]}
                  />
                  <TextInput
                    value={row.price}
                    onChangeText={(t) => updateItemRow(row.id, { price: t })}
                    placeholder="Price (optional)"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                    autoCorrect={false}
                    style={[editInputStyle, { flex: 1.4, marginBottom: 0 }]}
                  />
                  <TouchableOpacity
                    onPress={() => removeItemRow(row.id)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: "rgba(239,68,68,0.15)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#ef4444" }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                onPress={addItemRow}
                style={{
                  alignSelf: "flex-start",
                  paddingVertical: 8,
                  paddingHorizontal: 4,
                  marginBottom: 14,
                }}
              >
                <Text
                  className="font-inter-bold"
                  style={{ color: Colors.primary ?? "#4b7c59", fontSize: 13 }}
                >
                  + Add another product
                </Text>
              </TouchableOpacity>

              <TextInput
                value={newInvoice.discount}
                onChangeText={(t) =>
                  setNewInvoice((p) => ({ ...p, discount: t }))
                }
                placeholder="Discount (Rs., optional — applies to whole invoice)"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                style={editInputStyle}
              />

              <Text
                className="text-text-muted font-inter"
                style={{ fontSize: 12, marginBottom: 14 }}
              >
                Leave price blank to use the price on file. Enter a price to
                override it for this invoice - this also updates the product's
                stored price. Unrecognized SKUs/names are added as new products.
              </Text>

              <View className="flex-row flex-wrap gap-3 mt-1">
                <TouchableOpacity
                  disabled={savingAdd}
                  onPress={handleAddInvoice}
                  style={{
                    flex: 1,
                    minWidth: 140,
                    backgroundColor: Colors.primary ?? "#4b7c59",
                    borderRadius: 12,
                    paddingVertical: 14,
                    alignItems: "center",
                    opacity: savingAdd ? 0.6 : 1,
                  }}
                >
                  <Text className="text-text font-inter-bold">
                    {savingAdd ? "Creating..." : "Create Invoice"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    resetAddModal();
                    setAddModalVisible(false);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 140,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    paddingVertical: 14,
                    alignItems: "center",
                  }}
                >
                  <Text className="text-text font-inter">Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* New Purchase Invoice Modal */}
      <Modal visible={purchaseModalVisible} animationType="slide" transparent>
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
              New Purchase Invoice
            </Text>

            <TextInput
              value={newPurchaseInvoice.vendor}
              onChangeText={(t) =>
                setNewPurchaseInvoice((p) => ({ ...p, vendor: t }))
              }
              placeholder="Vendor name"
              placeholderTextColor={Colors.textMuted}
              autoCorrect={false}
              style={editInputStyle}
            />
            <TextInput
              value={newPurchaseInvoice.invoiceNumber}
              onChangeText={(t) =>
                setNewPurchaseInvoice((p) => ({ ...p, invoiceNumber: t }))
              }
              placeholder="Purchase invoice number"
              placeholderTextColor={Colors.textMuted}
              autoCorrect={false}
              style={editInputStyle}
            />
            <TextInput
              value={newPurchaseInvoice.date}
              onChangeText={(t) =>
                setNewPurchaseInvoice((p) => ({ ...p, date: t }))
              }
              placeholder="Date (e.g. Jul 20, 2024)"
              placeholderTextColor={Colors.textMuted}
              autoCorrect={false}
              style={editInputStyle}
            />
            <View className="flex-row flex-wrap gap-2 mb-3">
              {(["pending", "paid"] as InvoiceStatus[]).map((statusKey) => {
                const active = newPurchaseInvoice.status === statusKey;
                const chipMeta = STATUS_META[statusKey];
                return (
                  <TouchableOpacity
                    key={statusKey}
                    onPress={() =>
                      setNewPurchaseInvoice((p) => ({
                        ...p,
                        status: statusKey,
                      }))
                    }
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                      backgroundColor: active
                        ? chipMeta.bg
                        : "rgba(255,255,255,0.05)",
                      borderWidth: 1,
                      borderColor: active
                        ? chipMeta.color
                        : "rgba(255,255,255,0.1)",
                    }}
                  >
                    <Text
                      style={{
                        color: active ? chipMeta.color : Colors.textMuted,
                        fontSize: 12,
                        fontWeight: "600",
                        textTransform: "capitalize",
                      }}
                    >
                      {statusKey}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text
              className="text-text font-inter-bold"
              style={{ fontSize: Spacing[4], marginBottom: 8 }}
            >
              Products
            </Text>

            {itemDrafts.map((row) => (
              <View
                key={row.id}
                className="flex-row items-center gap-2"
                style={{ marginBottom: 10 }}
              >
                <TextInput
                  value={row.queryText}
                  onChangeText={(t) => updateItemRow(row.id, { queryText: t })}
                  placeholder="Item name"
                  placeholderTextColor={Colors.textMuted}
                  autoCorrect={false}
                  style={[editInputStyle, { flex: 2, marginBottom: 0 }]}
                />
                <TextInput
                  value={row.quantity}
                  onChangeText={(t) => updateItemRow(row.id, { quantity: t })}
                  placeholder="Qty"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  autoCorrect={false}
                  style={[editInputStyle, { flex: 1, marginBottom: 0 }]}
                />
                <TextInput
                  value={row.price}
                  onChangeText={(t) => updateItemRow(row.id, { price: t })}
                  placeholder="Price"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                  autoCorrect={false}
                  style={[editInputStyle, { flex: 1.4, marginBottom: 0 }]}
                />
                <TouchableOpacity
                  onPress={() => removeItemRow(row.id)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: "rgba(239,68,68,0.15)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#ef4444" }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              onPress={addItemRow}
              style={{
                alignSelf: "flex-start",
                paddingVertical: 8,
                paddingHorizontal: 4,
                marginBottom: 14,
              }}
            >
              <Text
                className="font-inter-bold"
                style={{ color: Colors.primary ?? "#4b7c59", fontSize: 13 }}
              >
                + Add another product
              </Text>
            </TouchableOpacity>

            <Text
              className="text-text-muted font-inter"
              style={{ fontSize: 12, marginBottom: 14 }}
            >
              Leave price blank to use the price on file. Enter a price to
              override it for this invoice - this also updates the product's
              stored price.
            </Text>

            <View className="flex-row flex-wrap gap-3 mt-1">
              <TouchableOpacity
                disabled={savingAdd}
                onPress={handleAddPurchaseInvoice}
                style={{
                  flex: 1,
                  minWidth: 140,
                  backgroundColor: Colors.primary ?? "#4b7c59",
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: savingAdd ? 0.6 : 1,
                }}
              >
                <Text className="text-text font-inter-bold">
                  {savingAdd ? "Creating..." : "Create Purchase Invoice"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  resetPurchaseModal();
                  setPurchaseModalVisible(false);
                }}
                style={{
                  flex: 1,
                  minWidth: 140,
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

      {/* Record Payment Modal */}
      <Modal visible={paymentModalVisible} animationType="fade" transparent>
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
              backgroundColor: Colors.background ?? "#111",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <Text
              className="text-text font-inter-bold"
              style={{ fontSize: Spacing[5], marginBottom: 4 }}
            >
              Record Payment
            </Text>
            {paymentInvoice && (
              <Text
                className="text-text-muted font-inter"
                style={{ fontSize: 13, marginBottom: 14 }}
              >
                {paymentInvoice.invoiceNumber} · {paymentInvoice.client}
                {"\n"}
                Balance due: {formatPKR(getBalanceDue(paymentInvoice))}
              </Text>
            )}

            <TextInput
              value={paymentAmountText}
              onChangeText={setPaymentAmountText}
              placeholder="Amount received"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              autoCorrect={false}
              style={editInputStyle}
            />

            <View className="flex-row flex-wrap gap-3 mt-2">
              <TouchableOpacity
                disabled={savingPayment}
                onPress={handleRecordPayment}
                style={{
                  flex: 1,
                  minWidth: 140,
                  backgroundColor: Colors.primary ?? "#4b7c59",
                  borderRadius: 10,
                  paddingVertical: 12,
                  alignItems: "center",
                  opacity: savingPayment ? 0.6 : 1,
                }}
              >
                <Text className="text-text font-inter-bold">
                  {savingPayment ? "Saving..." : "Save Payment"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={closePaymentModal}
                style={{
                  flex: 1,
                  minWidth: 140,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  paddingVertical: 12,
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

const styles = StyleSheet.create({
  buttonInactive: {
    backgroundColor: Colors.background,
    borderColor: "rgba(255,255,255,0.1)",
  },
  buttonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary ?? "#4b7c59",
  },
});

export default InvoicesScreen;
