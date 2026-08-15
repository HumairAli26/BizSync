import { auth, db } from "@/config/firebaseConfig";
import { icons } from "@/constants/icons";
import { Colors, Spacing } from "@/constants/theme";
import {
  validateNonNegativeNumber,
  validatePositiveInteger,
  validateRequiredText,
} from "@/lib/validation";
import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
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
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SearchIcon = icons.search;
const DownloadIcon = icons.download;
const MoreIcon = icons.moreVertical ?? icons.more;

const SafeAreaView = styled(RNSafeAreaView);
const DESKTOP_BREAKPOINT = 900;

// Basic-plan monthly quotation cap — Pro orgs are unlimited.
const BASIC_MONTHLY_QUOTATION_LIMIT = 5;

type QuotationStatus =
  "accepted" | "pending" | "rejected" | "expired" | "converted";

type QuotationItem = {
  query: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  matched: boolean;
};

type Quotation = {
  id: string;
  client: string;
  quotationNumber: string;
  date: string;
  amount: number;
  status: QuotationStatus;
  customerId?: string;
  customerName?: string;
  items?: QuotationItem[];
  subtotal?: number;
  discount?: number;
  createdAt?: number;
};

type InvoiceStatus = "paid" | "pending" | "overdue" | "draft" | "partial";

type Invoice = {
  id: string;
  invoiceNumber?: string;
  createdAt?: number;
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

type QuotationItemDraft = {
  id: string;
  queryText: string;
  quantity: string;
  price: string;
};

const STATUS_META: Record<
  QuotationStatus,
  {
    label: string;
    color: string;
    bg: string;
  }
> = {
  accepted: {
    label: "Accepted",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.15)",
  },
  pending: {
    label: "Pending",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.15)",
  },
  rejected: {
    label: "Rejected",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.15)",
  },
  expired: {
    label: "Expired",
    color: "#9ca3af",
    bg: "rgba(156,163,175,0.15)",
  },
  converted: {
    label: "Converted",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.15)",
  },
};

const STATUS_TABS: { key: "all" | QuotationStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "converted", label: "Converted" },
  { key: "rejected", label: "Rejected" },
];

// ---- Automatic Quotation Number generation ----
const generateNextQuotationNumber = (quotations: Quotation[]) => {
  if (!quotations.length) return "QT-0001";

  const numbers = quotations
    .map((q) => {
      const match = q.quotationNumber?.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    })
    .sort((a, b) => b - a);

  return `QT-${String(numbers[0] + 1).padStart(4, "0")}`;
};

const generateNextInvoiceNumber = (invoices: Invoice[]) => {
  if (!invoices.length) return "INV-0001";

  const numbers = invoices
    .map((i) => {
      const match = i.invoiceNumber?.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    })
    .sort((a, b) => b - a);

  return `INV-${String(numbers[0] + 1).padStart(4, "0")}`;
};

const getTodayDate = () => new Date().toISOString().slice(0, 10);

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

// ---- HTML escaping for untrusted Firestore strings ----
const escapeHtml = (str: string | null | undefined): string => {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const QUOTATION_PDF_CSS = `
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 26px; color: #1a1a1a; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 16px; }
  .org-name { font-size: 19px; font-weight: 700; margin: 0; }
  .org-details { font-size: 11px; color: #1a1a1a; font-weight: 600; margin-top: 3px; line-height: 1.45; }
  .doc-title { font-size: 22px; font-weight: 700; text-align: right; margin: 0; color: #1a1a1a; }
  .doc-meta { text-align: right; font-size: 11px; color: #1a1a1a; font-weight: 600; margin-top: 5px; }
  .status-badge { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .client-block { margin-bottom: 16px; }
  .client-label { font-size: 10px; text-transform: uppercase; color: #666; font-weight: 700; margin-bottom: 3px; }
  .client-name { font-size: 14px; font-weight: 700; }
  .items-table-wrap { border: 1.5px solid #1a1a1a; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #1a1a1a;
       letter-spacing: 0.4px; border-bottom: 1.5px solid #1a1a1a; border-right: 1px solid #1a1a1a;
       padding: 6px 8px; background: #f2f2f2; }
  th:last-child, td.last-col { border-right: none; }
  .amount-col { text-align: right; width: 120px; }
  .totals { margin-top: 14px; display: flex; justify-content: flex-end; }
  .totals-block { width: 240px; }
  .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; }
  .totals-row.grand { border-top: 1.5px solid #1a1a1a; margin-top: 4px; padding-top: 8px; font-size: 15px; font-weight: 700; }
  .signature-footer { margin-top: 46px; display: flex; justify-content: flex-end; }
  .signature-block { width: 220px; text-align: left; }
  .signature-line { border-bottom: 1px solid #1a1a1a; height: 26px; }
  .signature-field { font-size: 11px; margin-top: 6px; line-height: 1.5; }
  .signature-field strong { font-weight: 700; }
  .footer { margin-top: 26px; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 10px; text-align: center; }
`;

type QuotationPdfOptions = {
  quotation: Quotation;
  orgName: string;
  orgAddress: string;
  orgEmail: string;
  orgPhone: string;
  orgCell: string;
  orgNtn: string;
  orgSalesTaxNo: string;
  signedInUserName: string;
};

const buildQuotationHtml = (opts: QuotationPdfOptions): string => {
  const {
    quotation,
    orgName,
    orgAddress,
    orgEmail,
    orgPhone,
    orgCell,
    orgNtn,
    orgSalesTaxNo,
    signedInUserName,
  } = opts;

  const meta = STATUS_META[quotation.status] ?? STATUS_META.pending;
  const items = quotation.items ?? [];
  const subtotal =
    quotation.subtotal ?? items.reduce((s, i) => s + i.lineTotal, 0);
  const discount = quotation.discount ?? 0;

  const rowsHtml =
    items.length > 0
      ? items
          .map((item, idx) => {
            const td = `padding:6px 8px;border-bottom:1px solid #1a1a1a;border-right:1px solid #1a1a1a;`;
            return `<tr>
              <td style="${td}">${idx + 1}</td>
              <td style="${td}">${escapeHtml(item.name)}</td>
              <td style="${td}">${item.quantity}</td>
              <td style="${td}">${formatPKR(item.unitPrice)}</td>
              <td class="last-col" style="padding:6px 8px;border-bottom:1px solid #1a1a1a;text-align:right;width:120px;">${formatPKR(item.lineTotal)}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="5" style="text-align:center;padding:20px;color:#666;">No items on this quotation.</td></tr>`;

  const hasOrgDetails = Boolean(
    orgAddress || orgEmail || orgPhone || orgCell || orgNtn || orgSalesTaxNo,
  );
  const orgDetailsHtml = hasOrgDetails
    ? `<div class="org-details">
        ${orgAddress ? `${escapeHtml(orgAddress)}<br/>` : ""}
        ${orgEmail ? `${escapeHtml(orgEmail)}<br/>` : ""}
        ${orgPhone ? `Ph: ${escapeHtml(orgPhone)}` : ""}${orgCell ? ` | Cell: ${escapeHtml(orgCell)}` : ""}<br/>
        ${orgNtn ? `NTN: ${escapeHtml(orgNtn)}` : ""}${orgSalesTaxNo ? ` | STRN: ${escapeHtml(orgSalesTaxNo)}` : ""}
      </div>`
    : "";

  const preparedAt = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `<html><head><meta charset="utf-8"/><style>${QUOTATION_PDF_CSS}</style></head><body>
    <div class="header">
      <div>
        <p class="org-name">${escapeHtml(orgName || "Your Business")}</p>
        ${orgDetailsHtml}
      </div>
      <div>
        <p class="doc-title">QUOTATION</p>
        <div class="doc-meta">
          ${escapeHtml(quotation.quotationNumber)}<br/>
          Date: ${escapeHtml(quotation.date)}
        </div>
        <div style="text-align:right;">
          <span class="status-badge" style="background:${meta.bg};color:${meta.color};">${meta.label}</span>
        </div>
      </div>
    </div>

    <div class="client-block">
      <div class="client-label">Quotation For</div>
      <div class="client-name">${escapeHtml(quotation.client)}</div>
    </div>

    <div class="items-table-wrap"><table>
      <thead><tr>
        <th style="width:36px;">Sr#</th>
        <th>Item</th>
        <th style="width:60px;">Qty</th>
        <th style="width:110px;">Unit Price</th>
        <th class="amount-col">Total</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table></div>

    <div class="totals">
      <div class="totals-block">
        <div class="totals-row"><span>Subtotal</span><span>${formatPKR(subtotal)}</span></div>
        ${discount > 0 ? `<div class="totals-row"><span>Discount</span><span>-${formatPKR(discount)}</span></div>` : ""}
        <div class="totals-row grand"><span>Total</span><span>${formatPKR(quotation.amount)}</span></div>
      </div>
    </div>

    <div class="signature-footer"><div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-field"><strong>Signature</strong></div>
      <div class="signature-field"><strong>Prepared By:</strong> ${escapeHtml(signedInUserName || "Authorized Signatory")}</div>
      <div class="signature-field"><strong>Date:</strong> ${preparedAt}</div>
    </div></div>

    <div class="footer">Generated with BizSync — Thank you for your business</div>
  </body></html>`;
};

const printHtmlInIsolatedWindow = (
  html: string,
  title: string,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const printWindow = window.open("", "_blank", "width=900,height=1000");

    if (!printWindow) {
      reject(
        new Error(
          "Your browser blocked the print window. Please allow pop-ups for this site and try again.",
        ),
      );
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.document.title = title;

    let hasPrinted = false;
    const triggerPrint = () => {
      if (hasPrinted) return;
      hasPrinted = true;
      printWindow.focus();
      printWindow.print();
      resolve();
    };

    printWindow.onload = triggerPrint;
    setTimeout(triggerPrint, 300);
  });
};

let draftIdCounter = 1;
const nextDraftId = () => String(draftIdCounter++);

const QuotationsScreen = () => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | QuotationStatus>("all");

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Quotation>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const [newQuotation, setNewQuotation] = useState({
    client: "",
    quotationNumber: "",
    date: "",
    status: "pending" as QuotationStatus,
    discount: "",
  });

  const [itemDrafts, setItemDrafts] = useState<QuotationItemDraft[]>([
    { id: nextDraftId(), queryText: "", quantity: "1", price: "" },
  ]);

  const [editItemDrafts, setEditItemDrafts] = useState<QuotationItemDraft[]>(
    [],
  );
  // Discount while editing — kept as a separate string field so the
  // TextInput behaves like every other draft input (newQuotation.discount
  // works the same way) instead of fighting editDraft's numeric typing.
  const [editDiscountText, setEditDiscountText] = useState("");

  const [orgId, setOrgId] = useState<string>("");
  const [orgPlan, setOrgPlan] = useState<string>("basic");

  // Org branding for the quotation PDF header — same admin-doc lookup
  // pattern used on the Invoices screen, so a non-admin teammate's
  // downloaded quotation still shows the business's address/contact info.
  const [orgName, setOrgName] = useState<string>("");
  const [orgEmail, setOrgEmail] = useState<string>("");
  const [orgPhone, setOrgPhone] = useState<string>("");
  const [orgCell, setOrgCell] = useState<string>("");
  const [orgAddress, setOrgAddress] = useState<string>("");
  const [orgNtn, setOrgNtn] = useState<string>("");
  const [orgSalesTaxNo, setOrgSalesTaxNo] = useState<string>("");
  const [signedInUserName, setSignedInUserName] = useState<string>("");

  React.useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsubscribe = onSnapshot(doc(db, "users", uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setOrgId(data.orgId ?? "");
        setSignedInUserName(data.name ?? auth.currentUser?.displayName ?? "");
      }
    });

    return unsubscribe;
  }, []);

  // Subscription plan — source of truth is organizations/{orgId}.subscription.plan
  React.useEffect(() => {
    if (!orgId) return;
    const unsubscribe = onSnapshot(
      doc(db, "organizations", orgId),
      (snapshot) => {
        if (snapshot.exists()) {
          setOrgPlan(snapshot.data().subscription?.plan ?? "basic");
        }
      },
    );
    return unsubscribe;
  }, [orgId]);

  React.useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "invoices"),
      where("orgId", "==", orgId),
      orderBy("createdAt", "desc"),
    );
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
        console.error("Invoices listener error (quotations):", error);
      },
    );
    return () => unsubscribe();
  }, [orgId]);

  const isPro = orgPlan === "pro";

  // Org branding (address/phone/cell/NTN/sales tax no, org name, org email)
  // from whichever teammate has role "admin" — mirrors the Invoices screen.
  React.useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "users"),
      where("orgId", "==", orgId),
      where("role", "==", "admin"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const adminDoc = snapshot.docs[0];
        if (adminDoc) {
          const data = adminDoc.data();
          setOrgName(data.orgName ?? "");
          setOrgEmail(data.orgEmail ?? "");
          setOrgPhone(data.orgPhone ?? "");
          setOrgCell(data.orgCell ?? "");
          setOrgAddress(data.orgAddress ?? "");
          setOrgNtn(data.orgNtn ?? "");
          setOrgSalesTaxNo(data.orgSalesTaxNo ?? "");
        }
      },
      (error) => {
        console.error("Org admin details listener error (quotations):", error);
      },
    );
    return () => unsubscribe();
  }, [orgId]);

  React.useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "quotations"),
      where("orgId", "==", orgId),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Quotation, "id">),
        }));
        setQuotations(data);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore quotation listener error:", error);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [orgId]);

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
        console.error("Customers listener error:", error);
      },
    );
    return () => unsubscribe();
  }, [orgId]);

  const filteredQuotations = useMemo(() => {
    let list = quotations;
    if (activeTab !== "all") {
      list = list.filter((qt) => qt.status === activeTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (qt) =>
          (qt.client ?? "").toLowerCase().includes(q) ||
          (qt.quotationNumber ?? "").toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }, [quotations, activeTab, search]);

  const stats = useMemo(() => {
    const totalPending = quotations
      .filter((qt) => qt.status === "pending")
      .reduce((sum, qt) => sum + qt.amount, 0);
    const totalAccepted = quotations
      .filter((qt) => qt.status === "accepted")
      .reduce((sum, qt) => sum + qt.amount, 0);
    const totalConverted = quotations
      .filter((qt) => qt.status === "converted")
      .reduce((sum, qt) => sum + qt.amount, 0);

    return { totalPending, totalAccepted, totalConverted };
  }, [quotations]);

  // How many quotations this org has created in the current calendar month —
  // drives the Basic-plan cap below.
  const quotationsThisMonth = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1,
    ).getTime();
    return quotations.filter(
      (qt) =>
        typeof qt.createdAt === "number" &&
        qt.createdAt >= monthStart &&
        qt.createdAt < monthEnd,
    ).length;
  }, [quotations]);

  const quotationLimitReached =
    !isPro && quotationsThisMonth >= BASIC_MONTHLY_QUOTATION_LIMIT;

  const promptQuotationUpgrade = () => {
    Alert.alert(
      "Monthly Limit Reached",
      `Basic plan is limited to ${BASIC_MONTHLY_QUOTATION_LIMIT} quotations per month. Upgrade to Pro for unlimited quotations.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Upgrade", onPress: () => router.push("/upgrade") },
      ],
    );
  };

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

  const updateItemRow = (id: string, patch: Partial<QuotationItemDraft>) => {
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
    setNewQuotation({
      client: "",
      quotationNumber: generateNextQuotationNumber(quotations),
      date: getTodayDate(),
      status: "pending",
      discount: "",
    });
    resetItemDrafts();
  };

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

  const updateEditItemRow = (
    id: string,
    patch: Partial<QuotationItemDraft>,
  ) => {
    setEditItemDrafts((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
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

  const validateQuotationDraftRows = (drafts: QuotationItemDraft[]) => {
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

  const processQuotationItems = async (
    drafts: QuotationItemDraft[],
  ): Promise<{ items: QuotationItem[]; total: number }> => {
    const items: QuotationItem[] = [];
    let total = 0;

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
        const unitPrice = hasManualPrice ? parsedManualPrice : 0;
        const lineTotal = quantity * unitPrice;

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

    return { items, total };
  };

  const handleAddQuotation = async () => {
    // Re-check the cap at submit time too — the modal could have been open
    // for a while, or another device on the same org could have added
    // quotations in the meantime.
    if (quotationLimitReached) {
      setAddModalVisible(false);
      promptQuotationUpgrade();
      return;
    }

    if (
      !validateRequiredText(newQuotation.client) ||
      !validateRequiredText(newQuotation.quotationNumber)
    ) {
      Alert.alert("Missing info", "Client and quotation number are required.");
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

    if (!validateQuotationDraftRows(itemDrafts)) return;

    setSavingAdd(true);
    try {
      const { items, total } = await processQuotationItems(itemDrafts);
      const discountAmount = Math.max(
        0,
        parseFloat(newQuotation.discount) || 0,
      );
      const finalTotal = Math.max(0, total - discountAmount);
      const customerLink = resolveCustomerLink(newQuotation.client.trim());

      await addDoc(collection(db, "quotations"), {
        orgId,
        client: newQuotation.client.trim(),
        quotationNumber: newQuotation.quotationNumber.trim(),
        date: newQuotation.date.trim() || new Date().toISOString().slice(0, 10),
        subtotal: total,
        discount: discountAmount,
        amount: finalTotal,
        status: newQuotation.status,
        customerId: customerLink.customerId ?? null,
        customerName: customerLink.customerName ?? null,
        items,
        createdAt: Date.now(),
      });

      resetAddModal();
      setAddModalVisible(false);
    } catch (error) {
      console.error("Error adding quotation:", error);
      Alert.alert("Error", "Could not add quotation. Please try again.");
    } finally {
      setSavingAdd(false);
    }
  };

  const startEdit = (quotation: Quotation) => {
    setEditId(quotation.id);
    setEditDraft({ ...quotation });
    setEditDiscountText(
      quotation.discount != null ? String(quotation.discount) : "",
    );

    if (quotation.items && quotation.items.length > 0) {
      setEditItemDrafts(
        quotation.items.map((item) => ({
          id: nextDraftId(),
          queryText: item.query || item.name || item.sku,
          quantity: String(item.quantity),
          price: String(item.unitPrice),
        })),
      );
    } else {
      setEditItemDrafts([
        { id: nextDraftId(), queryText: "", quantity: "1", price: "" },
      ]);
    }
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditDraft({});
    setEditItemDrafts([]);
    setEditDiscountText("");
  };

  const saveEdit = async (id: string) => {
    const draftClient = editDraft.client ?? "";
    const draftQuotationNumber = editDraft.quotationNumber ?? "";
    const draftDate = editDraft.date ?? "";

    if (
      !validateRequiredText(draftClient) ||
      !validateRequiredText(draftQuotationNumber)
    ) {
      Alert.alert("Missing info", "Client and quotation number are required.");
      return;
    }

    const hasAtLeastOneItem = editItemDrafts.some((d) => d.queryText.trim());
    if (!hasAtLeastOneItem) {
      Alert.alert(
        "No products added",
        "Add at least one product (SKU or name) with a quantity.",
      );
      return;
    }

    if (!validateQuotationDraftRows(editItemDrafts)) return;

    if (
      editDiscountText.trim() &&
      !validateNonNegativeNumber(editDiscountText)
    ) {
      Alert.alert(
        "Invalid discount",
        "Discount must be a valid non-negative number.",
      );
      return;
    }

    setSavingEdit(true);
    try {
      // Re-derive items, subtotal, and total from the edited rows —
      // this is what makes adding/removing/changing products on an
      // existing quotation actually take effect (previously saveEdit
      // ignored items entirely and just patched client/date/status).
      const { items, total } = await processQuotationItems(editItemDrafts);
      const discountAmount = Math.max(0, parseFloat(editDiscountText) || 0);
      const finalTotal = Math.max(0, total - discountAmount);
      const customerLink = resolveCustomerLink(draftClient.trim());

      await updateDoc(doc(db, "quotations", id), {
        client: draftClient.trim(),
        quotationNumber: draftQuotationNumber.trim(),
        date: draftDate.trim(),
        subtotal: total,
        discount: discountAmount,
        amount: finalTotal,
        status: editDraft.status ?? "pending",
        customerId: customerLink.customerId ?? null,
        customerName: customerLink.customerName ?? null,
        items,
      });
      setEditId(null);
      setEditDraft({});
      setEditItemDrafts([]);
      setEditDiscountText("");
    } catch (error) {
      console.error("Error updating quotation:", error);
      Alert.alert("Error", "Could not save changes. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = (id: string) => {
    const doDelete = async () => {
      try {
        await deleteDoc(doc(db, "quotations", id));
      } catch (error) {
        console.error("Error deleting quotation:", error);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Delete this quotation? This can't be undone.")) {
        doDelete();
      }
    } else {
      Alert.alert("Delete quotation", "This can't be undone.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const toggleExpand = (id: string) => {
    if (editId && editId !== id) cancelEdit();
    setExpandedId(expandedId === id ? null : id);
  };

  const handleNewQuotationPress = () => {
    if (quotationLimitReached) {
      promptQuotationUpgrade();
      return;
    }
    resetAddModal();
    setAddModalVisible(true);
  };

  // Generates a PDF for the quotation and opens the native share sheet —
  // on Android/iOS, WhatsApp shows up there automatically as a share
  // target (same as any other app that accepts PDF files), so "send on
  // WhatsApp" is just: Download -> pick WhatsApp -> pick the chat.
  // On web there's no native share sheet, so it opens the browser's print
  // dialog (Save as PDF) instead — the user can then attach that file in
  // WhatsApp Web manually.
  const handleDownloadQuotation = async (quotation: Quotation) => {
    setDownloadingId(quotation.id);
    try {
      const html = buildQuotationHtml({
        quotation,
        orgName,
        orgAddress,
        orgEmail,
        orgPhone,
        orgCell,
        orgNtn,
        orgSalesTaxNo,
        signedInUserName,
      });

      const fileBaseName = `quotation_${quotation.quotationNumber.replace(/[^a-zA-Z0-9-]/g, "_")}`;

      if (Platform.OS === "web") {
        await printHtmlInIsolatedWindow(html, fileBaseName);
        return;
      }

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const dest = new File(Paths.cache, `${fileBaseName}.pdf`);
      if (dest.exists) dest.delete();
      new File(uri).copy(dest);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(dest.uri, {
          mimeType: "application/pdf",
          dialogTitle: `Quotation ${quotation.quotationNumber}`,
          UTI: "com.adobe.pdf",
        });
      }
    } catch (error) {
      console.error("Quotation PDF generation failed:", error);
      Alert.alert("Error", "Could not generate the quotation PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const promptConvertUpgrade = () => {
    Alert.alert(
      "Pro Feature",
      "Converting quotations to invoices is available on the Pro plan. Upgrade to unlock this feature.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Upgrade", onPress: () => router.push("/upgrade") },
      ],
    );
  };

  const handleConvertToInvoice = async (quotation: Quotation) => {
    if (!isPro) {
      promptConvertUpgrade();
      return;
    }

    if (quotation.status === "converted") {
      Alert.alert(
        "Already converted",
        "This quotation has already been converted to an invoice.",
      );
      return;
    }

    if (!orgId) {
      Alert.alert("Error", "Organization info is missing. Please try again.");
      return;
    }

    setConvertingId(quotation.id);
    try {
      const items = quotation.items ?? [];
      const subtotal =
        quotation.subtotal ??
        items.reduce((sum, item) => sum + item.lineTotal, 0);
      const discount = quotation.discount ?? 0;
      const amount = Math.max(0, quotation.amount ?? subtotal - discount);
      const nextInvoiceNumber = generateNextInvoiceNumber(invoices);
      const invoiceStatus: InvoiceStatus = "pending";

      await addDoc(collection(db, "invoices"), {
        orgId,
        client: quotation.client,
        invoiceNumber: nextInvoiceNumber,
        date: getTodayDate(),
        subtotal,
        discount,
        amount,
        amountPaid: 0,
        status: invoiceStatus,
        type: "sales",
        customerId: quotation.customerId ?? null,
        customerName: quotation.customerName ?? null,
        items,
        sourceQuotationId: quotation.id,
        sourceQuotationNumber: quotation.quotationNumber,
        createdAt: Date.now(),
      });

      await updateDoc(doc(db, "quotations", quotation.id), {
        status: "converted",
      });

      Alert.alert("Success", `Invoice ${nextInvoiceNumber} created.`);
    } catch (error) {
      console.error("Error converting quotation to invoice:", error);
      Alert.alert("Error", "Could not convert quotation to invoice.");
    } finally {
      setConvertingId(null);
    }
  };

  const pendingParts = getPKRParts(stats.totalPending);
  const acceptedParts = getPKRParts(stats.totalAccepted);
  const convertedParts = getPKRParts(stats.totalConverted);

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
              Quotations
            </Text>
          </View>
          <View className="ml-3 flex-row items-center">
            <TouchableOpacity
              onPress={handleNewQuotationPress}
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
                {quotationLimitReached ? "🔒 New Quotation" : "+ New Quotation"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Basic-plan monthly usage indicator */}
        {!isPro && (
          <TouchableOpacity
            onPress={() => router.push("/upgrade")}
            activeOpacity={0.8}
            style={{
              marginTop: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: quotationLimitReached
                ? "rgba(239,68,68,0.1)"
                : "rgba(255,255,255,0.05)",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: quotationLimitReached
                ? "rgba(239,68,68,0.3)"
                : "rgba(255,255,255,0.08)",
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                color: quotationLimitReached ? "#ef4444" : Colors.textMuted,
                fontWeight: "600",
              }}
            >
              {quotationLimitReached
                ? `Monthly limit reached (${quotationsThisMonth}/${BASIC_MONTHLY_QUOTATION_LIMIT}) — upgrade for unlimited`
                : `${quotationsThisMonth}/${BASIC_MONTHLY_QUOTATION_LIMIT} quotations used this month`}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: Colors.primary ?? "#4b7c59",
                fontWeight: "700",
              }}
            >
              Upgrade
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View
        className="search-container"
        style={{
          flexDirection: "row",
          alignItems: "center",
          ...(isDesktop
            ? {
                alignSelf: "flex-start",
                width: "100%",
                maxWidth: 420,
                height: 48,
                overflow: "hidden",
                marginBottom: 24,
              }
            : null),
        }}
      >
        <SearchIcon
          color={Colors.textMuted}
          size={Spacing[5]}
          style={{ marginRight: Spacing[2], flexShrink: 0 }}
        />
        <TextInput
          placeholder="Search quotations..."
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
                  {pendingParts.currency}
                </Text>
                <Text
                  style={{ fontSize: Spacing[4.5], lineHeight: 24 }}
                  className="text-yellow-300 font-inter-bold"
                >
                  {pendingParts.value}
                </Text>
              </View>
              <Text
                style={{ fontSize: Spacing[3] }}
                className="text-text-muted"
              >
                Pending
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
                  {acceptedParts.currency}
                </Text>
                <Text
                  style={{ fontSize: Spacing[4.5], lineHeight: 24 }}
                  className="font-inter-bold text-green-400"
                >
                  {acceptedParts.value}
                </Text>
              </View>
              <Text
                style={{ fontSize: Spacing[3] }}
                className="text-text-muted"
              >
                Accepted
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
                  className="font-inter-bold text-blue-400"
                >
                  {convertedParts.currency}
                </Text>
                <Text
                  style={{ fontSize: Spacing[4.5], lineHeight: 24 }}
                  className="font-inter-bold text-blue-400"
                >
                  {convertedParts.value}
                </Text>
              </View>
              <Text
                style={{ fontSize: Spacing[3] }}
                className="text-text-muted"
              >
                Converted
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View className="flex-row flex-wrap items-center mt-5" style={{ gap: 6 }}>
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

      {/* Quotations List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 10 }}
        className="mt-4 mb-14"
      >
        {loading ? (
          <View className="items-center justify-center py-20">
            <Text className="text-text-muted font-inter">
              Loading quotations...
            </Text>
          </View>
        ) : filteredQuotations.length === 0 ? (
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
              <Text style={{ fontSize: 28 }}>📋</Text>
            </View>
            <Text
              className="text-text font-inter-bold"
              style={{ fontSize: Spacing[5] }}
            >
              No quotations yet
            </Text>
            <Text className="text-text-muted font-inter mt-1">
              Tap "+ New Quotation" to create your first quotation
            </Text>
          </View>
        ) : (
          filteredQuotations.map((quotation) => {
            const meta = STATUS_META[quotation.status] ?? STATUS_META.pending;
            const isExpanded = expandedId === quotation.id;
            const isEditing = editId === quotation.id;
            const isDownloading = downloadingId === quotation.id;
            const isConverting = convertingId === quotation.id;
            const canConvert = quotation.status !== "converted";

            return (
              <View
                key={quotation.id}
                style={{
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.1)",
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => toggleExpand(quotation.id)}
                >
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text
                        className="text-text font-inter-bold"
                        style={{ fontSize: Spacing[4] }}
                      >
                        {quotation.client}
                      </Text>
                      <Text
                        className="text-text-muted font-inter"
                        style={{ fontSize: Spacing[3] }}
                      >
                        {quotation.quotationNumber} · {quotation.date}
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

                <View
                  style={{
                    height: 1,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    marginVertical: 12,
                  }}
                />

                <View className="flex-row items-center justify-between">
                  <View>
                    <Text
                      className="text-text font-inter-bold"
                      style={{ fontSize: Spacing[6] }}
                    >
                      {formatPKR(quotation.amount)}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-2">
                    <TouchableOpacity
                      disabled={isDownloading}
                      onPress={(e: any) => {
                        e.stopPropagation?.();
                        handleDownloadQuotation(quotation);
                      }}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: "rgba(255,255,255,0.08)",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: isDownloading ? 0.5 : 1,
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
                        toggleExpand(quotation.id);
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

                {isExpanded && (
                  <View
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTopWidth: 1,
                      borderTopColor: "rgba(255,255,255,0.08)",
                    }}
                  >
                    {/* Read-only item summary — hidden while editing since
                        the editable rows below take over at that point. */}
                    {!isEditing &&
                      quotation.items &&
                      quotation.items.length > 0 && (
                        <View style={{ marginBottom: 12 }}>
                          {quotation.items.map((item, idx) => (
                            <View
                              key={`${quotation.id}-item-${idx}`}
                              className="flex-row items-center justify-between"
                              style={{ marginBottom: 6 }}
                            >
                              <Text
                                className="text-text font-inter"
                                style={{ fontSize: 13 }}
                              >
                                {item.name} × {item.quantity}
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
                          value={editDraft.quotationNumber}
                          onChangeText={(t) =>
                            setEditDraft((d) => ({ ...d, quotationNumber: t }))
                          }
                          placeholder="Quotation number"
                          placeholderTextColor={Colors.textMuted}
                          autoCorrect={false}
                          style={editInputStyle}
                        />
                        <TextInput
                          value={editDraft.date}
                          onChangeText={(t) =>
                            setEditDraft((d) => ({ ...d, date: t }))
                          }
                          placeholder="Date"
                          placeholderTextColor={Colors.textMuted}
                          autoCorrect={false}
                          style={editInputStyle}
                        />

                        <View className="flex-row flex-wrap gap-2 mb-3">
                          {(Object.keys(STATUS_META) as QuotationStatus[]).map(
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

                        {/* Editable products — add, remove, or change any
                            row, same interaction as the New Quotation
                            modal. */}
                        <Text
                          className="text-text font-inter-bold"
                          style={{
                            fontSize: Spacing[4],
                            marginTop: 4,
                            marginBottom: 8,
                          }}
                        >
                          Products
                        </Text>

                        {editItemDrafts.map((row) => (
                          <View
                            key={row.id}
                            className="flex-row items-center gap-2"
                            style={{ marginBottom: 10 }}
                          >
                            <TextInput
                              value={row.queryText}
                              onChangeText={(t) =>
                                updateEditItemRow(row.id, { queryText: t })
                              }
                              placeholder="SKU or product name"
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
                              autoCorrect={false}
                              style={[
                                editInputStyle,
                                { flex: 1, marginBottom: 0 },
                              ]}
                            />
                            <TextInput
                              value={row.price}
                              onChangeText={(t) =>
                                updateEditItemRow(row.id, { price: t })
                              }
                              placeholder="Price (optional)"
                              placeholderTextColor={Colors.textMuted}
                              keyboardType="decimal-pad"
                              autoCorrect={false}
                              style={[
                                editInputStyle,
                                { flex: 1.4, marginBottom: 0 },
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
                          onPress={(e: any) => {
                            e.stopPropagation?.();
                            addEditItemRow();
                          }}
                          style={{
                            alignSelf: "flex-start",
                            paddingVertical: 8,
                            paddingHorizontal: 4,
                            marginBottom: 14,
                          }}
                        >
                          <Text
                            className="font-inter-bold"
                            style={{
                              color: Colors.primary ?? "#4b7c59",
                              fontSize: 13,
                            }}
                          >
                            + Add another product
                          </Text>
                        </TouchableOpacity>

                        <TextInput
                          value={editDiscountText}
                          onChangeText={setEditDiscountText}
                          placeholder="Discount (Rs., optional)"
                          placeholderTextColor={Colors.textMuted}
                          keyboardType="decimal-pad"
                          style={editInputStyle}
                        />

                        <View className="flex-row flex-wrap gap-3">
                          <TouchableOpacity
                            disabled={savingEdit}
                            onPress={(e: any) => {
                              e.stopPropagation?.();
                              saveEdit(quotation.id);
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
                          disabled={isConverting || (!canConvert && isPro)}
                          onPress={(e: any) => {
                            e.stopPropagation?.();
                            if (!isPro) {
                              promptConvertUpgrade();
                              return;
                            }
                            handleConvertToInvoice(quotation);
                          }}
                          style={{
                            flex: 1,
                            minWidth: 120,
                            backgroundColor: !isPro
                              ? "rgba(156,163,175,0.15)"
                              : canConvert
                                ? "rgba(34,197,94,0.15)"
                                : "rgba(156,163,175,0.15)",
                            borderRadius: 10,
                            paddingVertical: 10,
                            alignItems: "center",
                            opacity: isConverting ? 0.6 : 1,
                          }}
                        >
                          <Text
                            style={{
                              color: !isPro
                                ? "#9ca3af"
                                : canConvert
                                  ? "#22c55e"
                                  : "#9ca3af",
                            }}
                            className="font-inter-bold"
                          >
                            {isConverting
                              ? "Converting..."
                              : !isPro
                                ? "🔒 Convert to Invoice"
                                : canConvert
                                  ? "Convert to Invoice"
                                  : "Already Converted"}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          disabled={isDownloading}
                          onPress={(e: any) => {
                            e.stopPropagation?.();
                            handleDownloadQuotation(quotation);
                          }}
                          style={{
                            flex: 1,
                            minWidth: 120,
                            backgroundColor: "rgba(59,130,246,0.15)",
                            borderRadius: 10,
                            paddingVertical: 10,
                            alignItems: "center",
                            opacity: isDownloading ? 0.6 : 1,
                          }}
                        >
                          <Text
                            style={{ color: "#3b82f6" }}
                            className="font-inter-bold"
                          >
                            {isDownloading
                              ? "Preparing..."
                              : "Download / Share"}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={(e: any) => {
                            e.stopPropagation?.();
                            startEdit(quotation);
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
                            handleDelete(quotation.id);
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

      {/* New Quotation Modal */}
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
                New Quotation
              </Text>

              <TextInput
                value={newQuotation.client}
                onChangeText={(t) =>
                  setNewQuotation((p) => ({ ...p, client: t }))
                }
                placeholder="Client name"
                placeholderTextColor={Colors.textMuted}
                autoCorrect={false}
                style={editInputStyle}
              />
              <TextInput
                value={newQuotation.quotationNumber}
                onChangeText={(t) =>
                  setNewQuotation((p) => ({ ...p, quotationNumber: t }))
                }
                placeholder="Quotation number"
                placeholderTextColor={Colors.textMuted}
                autoCorrect={false}
                style={editInputStyle}
              />
              <TextInput
                value={newQuotation.date}
                onChangeText={(t) =>
                  setNewQuotation((p) => ({ ...p, date: t }))
                }
                placeholder="Date"
                placeholderTextColor={Colors.textMuted}
                autoCorrect={false}
                style={editInputStyle}
              />

              <View className="flex-row flex-wrap gap-2 mb-3">
                {(Object.keys(STATUS_META) as QuotationStatus[]).map(
                  (statusKey) => {
                    const active = newQuotation.status === statusKey;
                    const chipMeta = STATUS_META[statusKey];
                    return (
                      <TouchableOpacity
                        key={statusKey}
                        onPress={() =>
                          setNewQuotation((p) => ({ ...p, status: statusKey }))
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
                value={newQuotation.discount}
                onChangeText={(t) =>
                  setNewQuotation((p) => ({ ...p, discount: t }))
                }
                placeholder="Discount (Rs., optional)"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                style={editInputStyle}
              />

              <View className="flex-row flex-wrap gap-3 mt-1">
                <TouchableOpacity
                  disabled={savingAdd}
                  onPress={handleAddQuotation}
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
                    {savingAdd ? "Creating..." : "Create Quotation"}
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

export default QuotationsScreen;
