import { auth, db } from "@/config/firebaseConfig";
import { icons } from "@/constants/icons";
import { Colors } from "@/constants/theme";
import { getCurrentMonthYear } from "@/lib/currentMonth";
import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { styled } from "nativewind";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

// ---- Pakistani Rupee formatting (Rs. 1,23,456.00 style) ----
function formatPKR(amount: number | null | undefined): string {
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
}

// ---- HTML escaping for untrusted Firestore strings ----
function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---- Shared ledger CSS (reused by both daily & weekly) ----
const LEDGER_CSS = `
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 26px; color: #1a1a1a; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 16px; }
  .org-name { font-size: 19px; font-weight: 700; margin: 0; }
  .org-details { font-size: 11px; color: #1a1a1a; font-weight: 600; margin-top: 3px; line-height: 1.45; }
  .invoice-title { font-size: 22px; font-weight: 700; text-align: right; margin: 0; color: #1a1a1a; }
  .invoice-meta { text-align: right; font-size: 11px; color: #1a1a1a; font-weight: 600; margin-top: 5px; }
  .items-table-wrap { border: 1.5px solid #1a1a1a; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #1a1a1a;
       letter-spacing: 0.4px; border-bottom: 1.5px solid #1a1a1a; border-right: 1px solid #1a1a1a;
       padding: 6px 8px; background: #f2f2f2; }
  th:last-child, td.last-col { border-right: none; }
  .amount-col { text-align: right; width: 120px; }
  .summary-cards { display: flex; justify-content: flex-end; gap: 15px; margin-top: 15px; }
  .summary-card { border: 1px solid #999; border-radius: 8px; padding: 8px 12px; background: #fafafa; min-width: 130px; text-align: right; }
  .summary-title { font-size: 9px; text-transform: uppercase; color: #555; font-weight: 700; margin-bottom: 3px; }
  .summary-value { font-size: 14px; font-weight: 700; }
  .signature-footer { margin-top: 46px; display: flex; justify-content: flex-end; }
  .signature-block { width: 220px; text-align: left; }
  .signature-line { border-bottom: 1px solid #1a1a1a; height: 26px; }
  .signature-field { font-size: 11px; margin-top: 6px; line-height: 1.5; }
  .signature-field strong { font-weight: 700; }
  .footer { margin-top: 26px; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 10px; text-align: center; }
`;

interface LedgerTx {
  createdAt?: number;
  amount: number;
  type?: string;
  client?: string;
  invoiceNumber?: string;
}

interface LedgerOptions {
  title: string;          // e.g. "DAILY LEDGER"
  periodLabel: string;    // e.g. "Date: Aug 4, 2026" or "Week: Aug 4 – Aug 9, 2026"
  timeColHeader: string;  // "Time" for daily, "Date & Time" for weekly
  emptyMessage: string;
  txs: LedgerTx[];
  orgName: string;
  orgAddress: string;
  orgEmail: string;
  orgPhone: string;
  orgCell: string;
  orgNtn: string;
  orgSalesTaxNo: string;
  signedInUserName: string;
  preparedAt: string;
  isWeekly: boolean;      // controls time display format
}

function buildLedgerHtml(opts: LedgerOptions): string {
  const {
    title, periodLabel, timeColHeader, emptyMessage,
    txs, orgName, orgAddress, orgEmail, orgPhone, orgCell,
    orgNtn, orgSalesTaxNo, signedInUserName, preparedAt, isWeekly,
  } = opts;

  let totalInflow = 0;
  let totalOutflow = 0;
  txs.forEach((t) => {
    const amt = Number(t.amount) || 0;
    if (amt < 0 || t.type === "purchase_payment") totalOutflow += Math.abs(amt);
    else totalInflow += amt;
  });
  const netBalance = totalInflow - totalOutflow;
  const netColor = netBalance >= 0 ? "#15803d" : "#b91c1c";

  const rowsHtml = txs.length > 0
    ? txs.map((t, idx) => {
      const isOutgoing = (Number(t.amount) || 0) < 0 || t.type === "purchase_payment";
      const amt = Math.abs(Number(t.amount) || 0);
      const timeStr = t.createdAt
        ? isWeekly
          ? new Date(t.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
          : new Date(t.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
        : "—";
      const desc = escapeHtml(t.client || (isOutgoing ? "Purchase payment" : "Invoice payment"));
      const ref = t.invoiceNumber ? `#${escapeHtml(t.invoiceNumber)}` : "—";
      const typeStr = isOutgoing ? "Expense / Outflow" : "Revenue / Inflow";
      const color = isOutgoing ? "#b91c1c" : "#15803d";
      const sign = isOutgoing ? "-" : "+";
      const td = `padding:6px 8px;border-bottom:1px solid #1a1a1a;border-right:1px solid #1a1a1a;`;
      return `<tr>
          <td style="${td}">${idx + 1}</td>
          <td style="${td}">${desc}</td>
          <td style="${td}">${ref}</td>
          <td style="${td}">${timeStr}</td>
          <td style="${td}">${typeStr}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #1a1a1a;text-align:right;width:120px;color:${color};font-weight:600;">${sign}${formatPKR(amt)}</td>
        </tr>`;
    }).join("")
    : `<tr><td colspan="6" style="text-align:center;padding:20px;color:#666;">${emptyMessage}</td></tr>`;

  const hasOrgDetails = Boolean(orgAddress || orgEmail || orgPhone || orgCell || orgNtn || orgSalesTaxNo);
  const orgDetailsHtml = hasOrgDetails ? `<div class="org-details">
    ${orgAddress ? `${escapeHtml(orgAddress)}<br/>` : ""}
    ${orgEmail ? `${escapeHtml(orgEmail)}<br/>` : ""}
    ${orgPhone ? `Ph: ${escapeHtml(orgPhone)}` : ""}${orgCell ? ` | Cell: ${escapeHtml(orgCell)}` : ""}<br/>
    ${orgNtn ? `NTN: ${escapeHtml(orgNtn)}` : ""}${orgSalesTaxNo ? ` | STRN: ${escapeHtml(orgSalesTaxNo)}` : ""}
  </div>` : "";

  return `<html><head><meta charset="utf-8"/><style>${LEDGER_CSS}</style></head><body>
  <div class="header">
    <div>
      <p class="org-name">${escapeHtml(orgName)}</p>
      ${orgDetailsHtml}
    </div>
    <div>
      <p class="invoice-title">${title}</p>
      <div class="invoice-meta">${periodLabel}<br/>Prepared By: ${escapeHtml(signedInUserName)}</div>
    </div>
  </div>
  <div class="items-table-wrap"><table>
    <thead><tr>
      <th style="width:40px;">Sr#</th>
      <th>Description</th>
      <th>Reference</th>
      <th>${timeColHeader}</th>
      <th>Type</th>
      <th style="text-align:right;width:130px;">Amount</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table></div>
  <div class="summary-cards">
    <div class="summary-card"><div class="summary-title" style="color:#15803d;">Total Inflow</div><div class="summary-value" style="color:#15803d;">${formatPKR(totalInflow)}</div></div>
    <div class="summary-card"><div class="summary-title" style="color:#b91c1c;">Total Outflow</div><div class="summary-value" style="color:#b91c1c;">${formatPKR(totalOutflow)}</div></div>
    <div class="summary-card"><div class="summary-title" style="color:${netColor};">Net Balance</div><div class="summary-value" style="color:${netColor};">${formatPKR(netBalance)}</div></div>
  </div>
  <div class="signature-footer"><div class="signature-block">
    <div class="signature-line"></div>
    <div class="signature-field"><strong>Signature</strong></div>
    <div class="signature-field"><strong>Name:</strong> ${escapeHtml(signedInUserName)}</div>
    <div class="signature-field"><strong>Date:</strong> ${preparedAt}</div>
  </div></div>
  <div class="footer">Generated with BizSync — Thank you for your business</div>
</body></html>`;
}

async function exportLedgerPdf(
  html: string,
  fileBaseName: string,
  dialogTitle: string,
  webTitle: string,
): Promise<void> {
  if (Platform.OS === "web") {
    await printHtmlInIsolatedWindow(html, webTitle);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const dest = new File(Paths.cache, `${fileBaseName}.pdf`);
  if (dest.exists) dest.delete();
  (new File(uri)).copy(dest);
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(dest.uri, {
      mimeType: "application/pdf",
      dialogTitle,
      UTI: "com.adobe.pdf",
    });
  }
}

function printHtmlInIsolatedWindow(html: string, title: string): Promise<void> {
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
}

// ─── Icons ───────────────────────────────────────────────────────────────────
const DollarIcon = icons.dollarsign;
const TrendUp = icons.trendup;
const Invoices = icons.invoices;

// ─── Brand & Chart Palette ────────────────────────────────────────────────────
const C = {
  bg: Colors.background,
  surface: Colors.surface,
  surface2: Colors.surface2,
  border: Colors.borderLight,
  text: Colors.text,
  muted: Colors.textMuted,
  secondary: Colors.textSecondary,
  primary: Colors.primary, // sage #647652
  revenue: "#10B981", // emerald green
  expenses: "#F59E0B", // amber yellow
  sales: Colors.blue, // #5AC8FA
  weekly: Colors.purple, // #5E5CE6
};

// ─── Onboarding date: Aug 2026 ────────────────────────────────────────────────
const ONBOARDING_MONTH = 7; // 0-indexed August
const ONBOARDING_YEAR = 2026;

const ALL_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Slice from Aug 2026 up to current month
function getActiveMonths(): string[] {
  const now = new Date();
  const nowMonth = now.getMonth();
  const nowYear = now.getFullYear();

  const result: string[] = [];
  let m = ONBOARDING_MONTH;
  let y = ONBOARDING_YEAR;

  while (y < nowYear || (y === nowYear && m <= nowMonth)) {
    result.push(ALL_MONTHS[m]);
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
    if (result.length > 24) break; // safety cap
  }
  return result;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const WEEKLY_DATA = [
  { label: "Mon", value: 24 },
  { label: "Tue", value: 63 },
  { label: "Wed", value: 45 },
  { label: "Thu", value: 81 },
  { label: "Fri", value: 57 },
  { label: "Sat", value: 72 },
];

// Per-month mock values aligned to ALL_MONTHS (Jan=0 … Dec=11)
const MONTHLY_RAW: Record<string, number> = {
  Aug: 42,
  Sep: 0,
  Oct: 0,
  Nov: 0,
  Dec: 0,
};
const FINANCE_RAW: Record<string, { rev: number; exp: number }> = {
  Aug: { rev: 68, exp: 41 },
};

// ─── Types ───────────────────────────────────────────────────────────────────
type Tab = "weekly" | "monthly" | "finance";

interface BarItem {
  value: number;
  label?: string;
  frontColor?: string;
  topLabelComponent?: () => React.ReactElement;
}

interface SelectedNode {
  label: string;
  value: number;
  type?: string;
}

// ─── Main component ───────────────────────────────────────────────────────────
const Analytics = () => {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 900;

  const [activeTab, setActiveTab] = useState<Tab>("weekly");
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [loadingWeeklyLedger, setLoadingWeeklyLedger] = useState(false);

  const [orgId, setOrgId] = useState<string>("");
  const [orgName, setOrgName] = useState<string>("BizSync");
  const [orgEmail, setOrgEmail] = useState<string>("");
  const [orgPhone, setOrgPhone] = useState<string>("");
  const [orgCell, setOrgCell] = useState<string>("");
  const [orgAddress, setOrgAddress] = useState<string>("");
  const [orgNtn, setOrgNtn] = useState<string>("");
  const [orgSalesTaxNo, setOrgSalesTaxNo] = useState<string>("");
  const [signedInUserName, setSignedInUserName] = useState<string>("");

  const activeMonths = useMemo(() => getActiveMonths(), []);

  // Fetch signed-in user's info (for name & orgId)
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsubscribe = onSnapshot(doc(db, "users", uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setOrgId(data.orgId ?? "");
        setSignedInUserName(
          data.name ?? auth.currentUser?.displayName ?? "Authorized Signatory",
        );
      }
    });

    return unsubscribe;
  }, []);

  // Fetch org branding details (admin settings)
  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "users"),
      where("orgId", "==", orgId),
      where("role", "==", "admin"),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const adminDoc = snapshot.docs[0];
      if (adminDoc) {
        const data = adminDoc.data();
        setOrgName(data.orgName ?? "BizSync");
        setOrgEmail(data.orgEmail ?? "");
        setOrgPhone(data.orgPhone ?? "");
        setOrgCell(data.orgCell ?? "");
        setOrgAddress(data.orgAddress ?? "");
        setOrgNtn(data.orgNtn ?? "");
        setOrgSalesTaxNo(data.orgSalesTaxNo ?? "");
      }
    });

    return unsubscribe;
  }, [orgId]);

  // ── Live Transactions State & Listener ────────────────────────────
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, "sales"), where("orgId", "==", orgId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const txs = snapshot.docs.map((d) => {
          const raw = d.data();
          // Normalize createdAt to ms-epoch number — guards against
          // Firestore Timestamp objects or Date objects in older docs
          let ts = raw.createdAt;
          if (ts != null && typeof ts !== "number") {
            ts = typeof ts.toMillis === "function" ? ts.toMillis() : new Date(ts).getTime();
          }
          return { id: d.id, ...raw, createdAt: ts };
        });
        setTransactions(txs);
      },
      (err) => {
        console.error("Sales query error in analytics:", err);
      },
    );
    return unsubscribe;
  }, [orgId]);

  // Month names constant matching getActiveMonths
  const MONTH_NAMES = useMemo(
    () => [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    [],
  );

  const getTxMonth = (timestamp: number) => {
    const d = new Date(timestamp);
    return MONTH_NAMES[d.getMonth()];
  };

  // ── Dynamic data maps ──────────────────────────────────────────────
  const monthlyDataMap = useMemo(() => {
    const map: Record<string, number> = {};
    activeMonths.forEach((m) => {
      map[m] = 0;
    });

    transactions.forEach((tx) => {
      if (!tx.createdAt) return;
      const mName = getTxMonth(tx.createdAt);
      if (map[mName] !== undefined) {
        const amt = Number(tx.amount) || 0;
        if (amt > 0 && tx.type !== "purchase_payment") {
          map[mName] += amt;
        }
      }
    });
    return map;
  }, [transactions, activeMonths]);

  const financeDataMap = useMemo(() => {
    const map: Record<string, { rev: number; exp: number }> = {};
    activeMonths.forEach((m) => {
      map[m] = { rev: 0, exp: 0 };
    });

    transactions.forEach((tx) => {
      if (!tx.createdAt) return;
      const mName = getTxMonth(tx.createdAt);
      if (map[mName] !== undefined) {
        const amt = Number(tx.amount) || 0;
        if (amt < 0 || tx.type === "purchase_payment") {
          map[mName].exp += Math.abs(amt);
        } else {
          map[mName].rev += amt;
        }
      }
    });
    return map;
  }, [transactions, activeMonths]);

  const weeklyData = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;

    const monday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + distanceToMonday,
    );
    const startOfMonday = monday.getTime();

    const days = [
      { label: "Mon", startOffset: 0 },
      { label: "Tue", startOffset: 1 },
      { label: "Wed", startOffset: 2 },
      { label: "Thu", startOffset: 3 },
      { label: "Fri", startOffset: 4 },
      { label: "Sat", startOffset: 5 },
    ];

    return days.map((d) => {
      const dayStart = startOfMonday + d.startOffset * 24 * 60 * 60 * 1000;
      const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;

      let daySales = 0;
      transactions.forEach((tx) => {
        if (!tx.createdAt) return;
        if (tx.createdAt >= dayStart && tx.createdAt <= dayEnd) {
          const amt = Number(tx.amount) || 0;
          if (amt > 0 && tx.type !== "purchase_payment") {
            daySales += amt;
          }
        }
      });

      return {
        label: d.label,
        value: daySales,
      };
    });
  }, [transactions]);

  const currentMonthName = useMemo(() => {
    return MONTH_NAMES[new Date().getMonth()];
  }, [MONTH_NAMES]);

  const currentMonthRev = useMemo(() => {
    return financeDataMap[currentMonthName]?.rev ?? 0;
  }, [financeDataMap, currentMonthName]);

  const currentMonthExp = useMemo(() => {
    return financeDataMap[currentMonthName]?.exp ?? 0;
  }, [financeDataMap, currentMonthName]);

  const weeklyPeakValue = useMemo(() => {
    if (weeklyData.length === 0) return 0;
    return Math.max(...weeklyData.map((d) => d.value));
  }, [weeklyData]);

  // ── Dynamic KPI cards ──────────────────────────────────────────────
  const kpiCards = useMemo(
    () => [
      {
        key: "revenue",
        icon: DollarIcon,
        iconBg: Colors.greenBg,
        iconColor: C.revenue,
        label: `${currentMonthName} Revenue`,
        value: formatPKR(currentMonthRev),
        unit: "",
      },
      {
        key: "expenses",
        icon: Invoices,
        iconBg: Colors.yellowBg,
        iconColor: C.expenses,
        label: `${currentMonthName} Expenses`,
        value: formatPKR(currentMonthExp),
        unit: "",
      },
      {
        key: "performance",
        icon: TrendUp,
        iconBg: Colors.purpleBg,
        iconColor: C.weekly,
        label: "Weekly Peak",
        value: formatPKR(weeklyPeakValue),
        unit: "",
      },
    ],
    [currentMonthName, currentMonthRev, currentMonthExp, weeklyPeakValue],
  );

  // ── Weekly bar data (raw PKR values) ────────────────────────────
  const weeklyBars: BarItem[] = useMemo(() => {
    return weeklyData.map((d) => ({
      value: d.value,
      label: d.label,
      frontColor: selected?.label === d.label ? C.revenue : C.weekly + "cc",
    }));
  }, [weeklyData, selected]);

  const weeklyMaxValue = useMemo(() => {
    const peak = Math.max(...weeklyData.map((d) => d.value), 1000);
    // Round up to a nice number
    const magnitude = Math.pow(10, Math.floor(Math.log10(peak)));
    return Math.ceil(peak / magnitude) * magnitude;
  }, [weeklyData]);

  // ── Monthly sales bar data (scaled per 10000) ──────────────────────
  const monthlyBars: BarItem[] = useMemo(() => {
    return activeMonths.map((m) => {
      const val = monthlyDataMap[m] ?? 0;
      return {
        value: Math.round((val / 10000) * 100) / 100,
        label: m,
        frontColor: selected?.label === m ? C.revenue : C.sales + "cc",
      };
    });
  }, [activeMonths, monthlyDataMap, selected]);

  // ── Finance grouped bar data (raw PKR, scale 0-100000) ────────────────────
  const financeBars: BarItem[] = useMemo(() => {
    return activeMonths.flatMap((m) => {
      const d = financeDataMap[m] ?? { rev: 0, exp: 0 };
      return [
        {
          value: d.rev,
          label: m,
          frontColor:
            selected?.label === m && selected.type === "rev"
              ? "#34d399"
              : C.revenue,
          spacing: 2,
        },
        {
          value: d.exp,
          frontColor:
            selected?.label === m && selected.type === "exp"
              ? "#fbbf24"
              : C.expenses,
          spacing: 18,
        },
      ];
    });
  }, [activeMonths, financeDataMap, selected]);

  const financeMaxValue = useMemo(() => {
    let peak = 100000;
    activeMonths.forEach((m) => {
      const d = financeDataMap[m] ?? { rev: 0, exp: 0 };
      if (d.rev > peak) peak = d.rev;
      if (d.exp > peak) peak = d.exp;
    });
    // Round up to nearest 10000
    return Math.ceil(peak / 10000) * 10000;
  }, [activeMonths, financeDataMap]);

  // ── Chart dims ──────────────────────────────────────────────────────────
  const chartCardPadding = 40; // 20 on each side
  const scrollContentPadding = 40; // 20 on each side
  const totalPadding = chartCardPadding + scrollContentPadding;
  const maxChartW = isDesktop ? 900 : windowWidth - totalPadding;
  const weeklyBarWidth = Math.floor((maxChartW - 130) / 6);

  // ── CSV Export ─────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      let csv = "";
      if (activeTab === "weekly") {
        csv =
          "Day,Sales (PKR)\n" +
          weeklyData.map((d) => `${d.label},${d.value}`).join("\n");
      } else if (activeTab === "monthly") {
        csv =
          "Month,Sales (PKR)\n" +
          activeMonths.map((m) => `${m},${monthlyDataMap[m] ?? 0}`).join("\n");
      } else {
        csv =
          "Month,Revenue (PKR),Expenses (PKR)\n" +
          activeMonths
            .map((m) => {
              const d = financeDataMap[m] ?? { rev: 0, exp: 0 };
              return `${m},${d.rev},${d.exp}`;
            })
            .join("\n");
      }

      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bizsync_${activeTab}_analytics.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const file = new File(
          Paths.document,
          `bizsync_${activeTab}_analytics.csv`,
        );
        file.write(csv);
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri, {
            mimeType: "text/csv",
            dialogTitle: "Export Analytics CSV",
          });
        }
      }
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadDailyLedger = async () => {
    if (!orgId) { Alert.alert("Error", "No organization ID found."); return; }
    setLoadingLedger(true);
    try {
      const now = new Date();
      // Use explicit midnight boundaries so timezone differences cannot bleed yesterday's records in
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

      const txs = transactions
        .filter((t) => {
          if (t.createdAt == null) return false;
          // Safety: coerce Firestore Timestamp or Date objects to ms
          const ts = typeof t.createdAt === "number" ? t.createdAt : (t.createdAt as any).toMillis?.() ?? new Date(t.createdAt).getTime();
          return ts >= startOfDay && ts <= endOfDay;
        })
        .map((t) => ({ ...t }));
      txs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
      const preparedAt = now.toLocaleString("en-US", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });

      const html = buildLedgerHtml({
        title: "DAILY LEDGER",
        periodLabel: `Date: ${dateStr}`,
        timeColHeader: "Time",
        emptyMessage: "No transactions recorded today.",
        txs,
        orgName, orgAddress, orgEmail, orgPhone, orgCell, orgNtn, orgSalesTaxNo,
        signedInUserName, preparedAt, isWeekly: false,
      });

      await exportLedgerPdf(html, `daily_ledger_${dateStr}`, `Daily Ledger - ${dateStr}`, `daily_ledger_${dateStr}`);
    } catch (error) {
      console.error("Ledger generation failed:", error);
      Alert.alert("Error", "Failed to generate daily ledger.");
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleDownloadWeeklyLedger = async () => {
    if (!orgId) { Alert.alert("Error", "No organization ID found."); return; }
    setLoadingWeeklyLedger(true);
    try {
      const now = new Date();
      const currentDay = now.getDay();
      const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + distanceToMonday, 0, 0, 0, 0);
      const saturday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 5, 23, 59, 59, 999);
      const startTs = monday.getTime();
      const endTs = saturday.getTime();

      const txs = transactions
        .filter((t) => t.createdAt != null && t.createdAt >= startTs && t.createdAt <= endTs)
        .map((t) => ({ ...t }));
      txs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const weekStart = fmt(monday);
      const weekEnd = fmt(saturday);
      const preparedAt = now.toLocaleString("en-US", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
      const fileBase = `weekly_ledger_${weekStart.replace(/,/g, "").replace(/ /g, "_")}_to_${weekEnd.replace(/,/g, "").replace(/ /g, "_")}`;

      const html = buildLedgerHtml({
        title: "WEEKLY LEDGER",
        periodLabel: `Week: ${weekStart} – ${weekEnd}`,
        timeColHeader: "Date &amp; Time",
        emptyMessage: "No transactions recorded this week.",
        txs,
        orgName, orgAddress, orgEmail, orgPhone, orgCell, orgNtn, orgSalesTaxNo,
        signedInUserName, preparedAt, isWeekly: true,
      });

      await exportLedgerPdf(html, fileBase, `Weekly Ledger ${weekStart} – ${weekEnd}`, `weekly_ledger_${weekStart}`);
    } catch (error) {
      console.error("Weekly ledger generation failed:", error);
      Alert.alert("Error", "Failed to generate weekly ledger.");
    } finally {
      setLoadingWeeklyLedger(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      let reportTitle = "";
      let rowsHtml = "";
      const dateStr = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      const preparedAt = new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      if (activeTab === "weekly") {
        reportTitle = "WEEKLY SALES REPORT";
        rowsHtml = weeklyData
          .map(
            (d, idx) => `
          <tr>
            <td style="padding: 6px 8px; border-bottom: 1px solid #1a1a1a; border-right: 1px solid #1a1a1a;">${idx + 1}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #1a1a1a; border-right: 1px solid #1a1a1a;">${d.label}</td>
            <td class="amount-col last-col" style="padding: 6px 8px; border-bottom: 1px solid #1a1a1a; text-align: right; width: 120px;">${formatPKR(d.value)}</td>
          </tr>
        `,
          )
          .join("");
      } else if (activeTab === "monthly") {
        reportTitle = "MONTHLY SALES REPORT";
        rowsHtml = activeMonths
          .map(
            (m, idx) => `
          <tr>
            <td style="padding: 6px 8px; border-bottom: 1px solid #1a1a1a; border-right: 1px solid #1a1a1a;">${idx + 1}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #1a1a1a; border-right: 1px solid #1a1a1a;">${m}</td>
            <td class="amount-col last-col" style="padding: 6px 8px; border-bottom: 1px solid #1a1a1a; text-align: right; width: 120px;">${formatPKR(monthlyDataMap[m] ?? 0)}</td>
          </tr>
        `,
          )
          .join("");
      } else {
        reportTitle = "FINANCIAL SUMMARY REPORT";
        rowsHtml = activeMonths
          .map((m, idx) => {
            const d = financeDataMap[m] ?? { rev: 0, exp: 0 };
            return `
            <tr>
              <td style="padding: 6px 8px; border-bottom: 1px solid #1a1a1a; border-right: 1px solid #1a1a1a;">${idx + 1}</td>
              <td style="padding: 6px 8px; border-bottom: 1px solid #1a1a1a; border-right: 1px solid #1a1a1a;">${m}</td>
              <td class="amount-col" style="padding: 6px 8px; border-bottom: 1px solid #1a1a1a; border-right: 1px solid #1a1a1a; text-align: right; width: 120px;">${formatPKR(d.rev)}</td>
              <td class="amount-col last-col" style="padding: 6px 8px; border-bottom: 1px solid #1a1a1a; text-align: right; width: 120px;">${formatPKR(d.exp)}</td>
            </tr>
          `;
          })
          .join("");
      }

      const tableHeaderHtml =
        activeTab === "finance"
          ? `
          <tr>
            <th style="width: 50px; padding: 6px 8px; border-bottom: 1.5px solid #1a1a1a; border-right: 1px solid #1a1a1a;">Sr#</th>
            <th style="padding: 6px 8px; border-bottom: 1.5px solid #1a1a1a; border-right: 1px solid #1a1a1a;">Month</th>
            <th class="amount-col" style="padding: 6px 8px; border-bottom: 1.5px solid #1a1a1a; border-right: 1px solid #1a1a1a; text-align: right; width: 120px;">Revenue</th>
            <th class="amount-col last-col" style="padding: 6px 8px; border-bottom: 1.5px solid #1a1a1a; text-align: right; width: 120px;">Expenses</th>
          </tr>
        `
          : `
          <tr>
            <th style="width: 50px; padding: 6px 8px; border-bottom: 1.5px solid #1a1a1a; border-right: 1px solid #1a1a1a;">Sr#</th>
            <th style="padding: 6px 8px; border-bottom: 1.5px solid #1a1a1a; border-right: 1px solid #1a1a1a;">${activeTab === "weekly" ? "Day" : "Month"}</th>
            <th class="amount-col last-col" style="padding: 6px 8px; border-bottom: 1.5px solid #1a1a1a; text-align: right; width: 120px;">${activeTab === "weekly" ? "Performance" : "Sales"}</th>
          </tr>
        `;

      const hasOrgDetails = Boolean(
        orgAddress ||
        orgEmail ||
        orgPhone ||
        orgCell ||
        orgNtn ||
        orgSalesTaxNo,
      );

      const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            * {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body {
              font-family: -apple-system, Helvetica, Arial, sans-serif;
              padding: 26px;
              color: #1a1a1a;
              font-size: 12px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #1a1a1a;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }
            .org-name {
              font-size: 19px;
              font-weight: 700;
              margin: 0;
            }
            .org-details {
              font-size: 11px;
              color: #1a1a1a;
              font-weight: 600;
              margin-top: 3px;
              line-height: 1.45;
            }
            .invoice-title {
              font-size: 20px;
              font-weight: 700;
              text-align: right;
              margin: 0;
              color: #1a1a1a;
            }
            .invoice-meta {
              text-align: right;
              font-size: 11px;
              color: #1a1a1a;
              font-weight: 600;
              margin-top: 5px;
            }
            .items-table-wrap {
              border: 1.5px solid #1a1a1a;
              margin-top: 15px;
              margin-bottom: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th {
              text-align: left;
              font-size: 10px;
              text-transform: uppercase;
              font-weight: 700;
              color: #1a1a1a;
              letter-spacing: 0.4px;
              border-bottom: 1.5px solid #1a1a1a;
              border-right: 1px solid #1a1a1a;
              padding: 6px 8px;
              background: #f2f2f2;
            }
            th:last-child,
            td.last-col {
              border-right: none;
            }
            .amount-col {
              text-align: right;
              width: 120px;
            }
            .signature-footer {
              margin-top: 46px;
              display: flex;
              justify-content: flex-end;
            }
            .signature-block {
              width: 220px;
              text-align: left;
            }
            .signature-line {
              border-bottom: 1px solid #1a1a1a;
              height: 26px;
            }
            .signature-field {
              font-size: 11px;
              margin-top: 6px;
              line-height: 1.5;
            }
            .signature-field strong {
              font-weight: 700;
            }
            .footer {
              margin-top: 26px;
              font-size: 10px;
              color: #999;
              border-top: 1px solid #eee;
              padding-top: 10px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <p class="org-name">${orgName}</p>
              ${hasOrgDetails
          ? `<div class="org-details">
                ${orgAddress ? `${orgAddress}<br/>` : ""}
                ${orgEmail ? `${orgEmail}<br/>` : ""}
                ${orgPhone ? `Ph: ${orgPhone}` : ""} ${orgCell ? ` | Cell: ${orgCell}` : ""}<br/>
                ${orgNtn ? `NTN: ${orgNtn}` : ""} ${orgSalesTaxNo ? ` | STRN: ${orgSalesTaxNo}` : ""}
              </div>`
          : ""
        }
            </div>
            <div>
              <p class="invoice-title">${reportTitle}</p>
              <div class="invoice-meta">
                Date: ${dateStr}<br/>
                Prepared By: ${signedInUserName}
              </div>
            </div>
          </div>

          <div class="items-table-wrap">
            <table>
              <thead>
                ${tableHeaderHtml}
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <div class="signature-footer">
            <div class="signature-block">
              <div class="signature-line"></div>
              <div class="signature-field"><strong>Signature</strong></div>
              <div class="signature-field"><strong>Name:</strong> ${signedInUserName}</div>
              <div class="signature-field"><strong>Date:</strong> ${preparedAt}</div>
            </div>
          </div>

          <div class="footer">
            Generated with BizSync — Thank you for your business
          </div>
        </body>
      </html>
      `;

      if (Platform.OS === "web") {
        await printHtmlInIsolatedWindow(html, `analytics_report_${activeTab}`);
      } else {
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        const fileName = `analytics_report_${activeTab}.pdf`;
        const source = new File(uri);
        const destination = new File(Paths.cache, fileName);
        if (destination.exists) {
          destination.delete();
        }
        source.copy(destination);
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(destination.uri, {
            mimeType: "application/pdf",
            dialogTitle: `Analytics Report - ${activeTab}`,
            UTI: "com.adobe.pdf",
          });
        }
      }
    } catch (error) {
      console.error("PDF generation failed:", error);
      Alert.alert("Error", "Failed to generate report PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  // ── Handle bar tap ──────────────────────────────────────────────────────
  const onWeeklyTap = ({ index }: { index: number }) => {
    const d = weeklyData[index];
    if (!d) return;
    setSelected((prev) =>
      prev?.label === d.label ? null : { label: d.label, value: d.value },
    );
  };

  const onMonthlyTap = ({ index }: { index: number }) => {
    const m = activeMonths[index];
    const v = monthlyDataMap[m] ?? 0;
    if (!m) return;
    setSelected((prev) => (prev?.label === m ? null : { label: m, value: v }));
  };

  const onFinanceTap = ({ index }: { index: number }) => {
    const monthIdx = Math.floor(index / 2);
    const isRev = index % 2 === 0;
    const m = activeMonths[monthIdx];
    const d = financeDataMap[m] ?? { rev: 0, exp: 0 };
    if (!m) return;
    const type = isRev ? "rev" : "exp";
    const value = isRev ? d.rev : d.exp;
    setSelected((prev) =>
      prev?.label === m && prev.type === type
        ? null
        : { label: m, value, type },
    );
  };

  // ── Chart configs ────────────────────────────────────────────────────────
  const commonChartProps = {
    barBorderRadius: 6,
    yAxisTextStyle: { color: C.muted, fontSize: 10 },
    xAxisLabelTextStyle: { color: C.muted, fontSize: 11 },
    xAxisColor: C.border,
    yAxisColor: "transparent",
    hideRules: false,
    rulesColor: C.surface2,
    rulesType: "solid" as const,
    noOfSections: 5,
    isAnimated: true,
  };

  // Y-axis formatter for PKR (e.g. 50000 → "50K")
  const formatYAxis = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
    return `${v}`;
  };

  const weeklyYAxisTexts = useMemo(() => {
    const step = weeklyMaxValue / 4;
    return Array.from({ length: 5 }, (_, i) => formatYAxis(i * step));
  }, [weeklyMaxValue]);

  const financeYAxisTexts = useMemo(() => {
    const step = financeMaxValue / 5;
    return Array.from({ length: 6 }, (_, i) => formatYAxis(i * step));
  }, [financeMaxValue]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.headerContainer}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.headerTitle}>Analytics</Text>
              <Text style={styles.headerSub}>Financial Overview</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{getCurrentMonthYear()}</Text>
            </View>
          </View>
          <View style={styles.ledgerRow}>
            <TouchableOpacity
              onPress={handleDownloadDailyLedger}
              disabled={loadingLedger}
              style={[
                styles.ledgerBtn,
                loadingLedger && styles.ledgerBtnDisabled,
              ]}
              activeOpacity={0.8}
            >
              {loadingLedger ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.ledgerBtnText}>📄 Daily Ledger</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDownloadWeeklyLedger}
              disabled={loadingWeeklyLedger}
              style={[
                styles.ledgerBtn,
                styles.weeklyLedgerBtn,
                loadingWeeklyLedger && styles.ledgerBtnDisabled,
              ]}
              activeOpacity={0.8}
            >
              {loadingWeeklyLedger ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.ledgerBtnText}>📅 Weekly Ledger</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── KPI Cards ────────────────────────────────────────────────── */}
        <View style={[styles.kpiRow, isDesktop && styles.kpiRowDesktop]}>
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <View
                key={card.key}
                style={[styles.kpiCard, isDesktop && styles.kpiCardDesktop]}
              >
                <View
                  style={[styles.kpiIcon, { backgroundColor: card.iconBg }]}
                >
                  <Icon color={card.iconColor} size={20} />
                </View>
                <View style={styles.kpiBody}>
                  <View style={styles.kpiValueRow}>
                    <Text style={[styles.kpiValue, { color: card.iconColor }]}>
                      {card.value}
                    </Text>
                    <Text style={styles.kpiUnit}>{card.unit}</Text>
                  </View>
                  <Text style={styles.kpiLabel} numberOfLines={1}>
                    {card.label}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Chart Card ───────────────────────────────────────────────── */}
        <View style={styles.chartCard}>
          {/* Tab navigation */}
          <View style={styles.tabBar}>
            {(["weekly", "monthly", "finance"] as Tab[]).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => {
                  setActiveTab(t);
                  setSelected(null);
                }}
                style={[
                  styles.tabItem,
                  activeTab === t && styles.tabItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === t && styles.tabTextActive,
                  ]}
                >
                  {t === "weekly"
                    ? "Weekly"
                    : t === "monthly"
                      ? "Monthly Sales"
                      : "Finance"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Chart title + export */}
          <View style={styles.chartHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.chartTitle}>
                {activeTab === "weekly"
                  ? "Weekly Performance"
                  : activeTab === "monthly"
                    ? "Monthly Sales"
                    : "Rev vs Exp"}
              </Text>
              <Text style={styles.chartSub}>
                {activeTab === "weekly"
                  ? "Mon – Sat  •  This week's sales"
                  : activeTab === "monthly"
                    ? `Since Aug ${ONBOARDING_YEAR}  •  1 = Rs. 10,000`
                    : `Since Aug ${ONBOARDING_YEAR}  •  Scale: Rs. 0 – 1,00,000`}
              </Text>

              {/* Finance legend below subtitle on left */}
              {activeTab === "finance" && (
                <View style={styles.legend}>
                  <View style={styles.legendItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: C.revenue }]}
                    />
                    <Text style={styles.legendText}>Revenue</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: C.expenses }]}
                    />
                    <Text style={styles.legendText}>Expenses</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* ── Charts ───────────────────────────────────────────────── */}
          {activeTab === "weekly" && (
            <View style={styles.chartWrap}>
              <BarChart
                data={weeklyBars}
                width={maxChartW - 50}
                height={220}
                {...commonChartProps}
                maxValue={weeklyMaxValue}
                noOfSections={4}
                yAxisLabelTexts={weeklyYAxisTexts}
                yAxisLabelWidth={40}
                barWidth={weeklyBarWidth}
                spacing={12}
                initialSpacing={12}
                endSpacing={12}
                frontColor={C.weekly + "cc"}
                onPress={onWeeklyTap}
              />
            </View>
          )}

          {activeTab === "monthly" && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.hScroll}
            >
              <BarChart
                data={monthlyBars}
                width={Math.max(maxChartW, activeMonths.length * 52)}
                height={220}
                {...commonChartProps}
                barWidth={32}
                spacing={20}
                initialSpacing={12}
                endSpacing={12}
                frontColor={C.sales + "cc"}
                onPress={onMonthlyTap}
              />
            </ScrollView>
          )}

          {activeTab === "finance" && (
            <View style={styles.chartBox}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.hScroll}
              >
                <BarChart
                  data={financeBars}
                  width={Math.max(maxChartW, activeMonths.length * 80)}
                  height={220}
                  {...commonChartProps}
                  maxValue={financeMaxValue}
                  noOfSections={5}
                  yAxisLabelTexts={financeYAxisTexts}
                  barWidth={22}
                  spacing={2}
                  initialSpacing={12}
                  endSpacing={12}
                  onPress={onFinanceTap}
                />
              </ScrollView>
            </View>
          )}

          {/* ── Selected node card ────────────────────────────────────── */}
          {selected && (
            <View style={styles.selectedCard}>
              <View style={styles.selectedLeft}>
                <View
                  style={[
                    styles.selectedDot,
                    {
                      backgroundColor:
                        selected.type === "exp" ? C.expenses : C.revenue,
                    },
                  ]}
                />
                <View>
                  <Text style={styles.selectedLabel}>
                    {selected.label}
                    {selected.type === "rev"
                      ? " · Revenue"
                      : selected.type === "exp"
                        ? " · Expenses"
                        : ""}
                  </Text>
                  <Text style={styles.selectedSub}>Tap again to dismiss</Text>
                </View>
              </View>
              <Text
                style={[
                  styles.selectedValue,
                  {
                    color: selected.type === "exp" ? C.expenses : C.revenue,
                  },
                ]}
              >
                {formatPKR(selected.value)}
              </Text>
            </View>
          )}

          {/* ── Export buttons ─────────────────────────────────────────── */}
          <View style={styles.exportRow}>
            <TouchableOpacity
              onPress={handleExport}
              disabled={exporting}
              style={[
                styles.exportBtn,
                styles.exportBtnOutline,
                exporting && styles.exportBtnDisabled,
              ]}
              activeOpacity={0.8}
            >
              {exporting ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.exportTextOutline}>⬇ Export CSV</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleExportPdf}
              disabled={exportingPdf}
              style={[
                styles.exportBtn,
                exportingPdf && styles.exportBtnDisabled,
              ]}
              activeOpacity={0.8}
            >
              {exportingPdf ? (
                <ActivityIndicator size="small" color={Colors.textInverse} />
              ) : (
                <Text style={styles.exportText}>📄 Export PDF</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Bottom spacing ────────────────────────────────────────────── */}
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  // Header
  headerContainer: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ledgerRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter-Bold",
    color: Colors.text,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter-Medium",
    color: Colors.textMuted,
    marginTop: 2,
  },
  badge: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
  },
  ledgerBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  weeklyLedgerBtn: {
    backgroundColor: Colors.purple ?? "#5E5CE6",
  },
  ledgerBtnDisabled: {
    opacity: 0.6,
  },
  ledgerBtnText: {
    color: Colors.textInverse,
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
  },

  // KPI cards
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  kpiRowDesktop: {
    gap: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingVertical: 12,
    paddingHorizontal: 6,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    overflow: "hidden",
  },
  kpiCardDesktop: {
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 10,
  },
  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  kpiBody: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  kpiLabel: {
    fontSize: 9,
    fontFamily: "Inter-SemiBold",
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 2,
  },
  kpiValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 1,
    flexWrap: "nowrap",
  },
  kpiValue: {
    fontSize: 15,
    fontFamily: "Inter-Bold",
    textAlign: "center",
  },
  kpiUnit: {
    fontSize: 9,
    fontFamily: "Inter-Medium",
    color: Colors.textMuted,
    marginLeft: 1,
  },

  // Chart card
  chartCard: {
    backgroundColor: Colors.background,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 20,
  },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 11,
  },
  tabItemActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.text,
  },

  // Chart header
  chartHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontFamily: "Inter-Bold",
    color: Colors.text,
  },
  chartSub: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: Colors.textMuted,
    marginTop: 3,
  },

  // Legend
  legend: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginTop: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: Colors.textSecondary,
  },

  // Chart wrapper
  chartWrap: {
    marginTop: 4,
  },
  hScroll: {
    marginTop: 4,
  },
  chartBox: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 10,
    marginTop: 4,
  },

  // Selected node card
  selectedCard: {
    marginTop: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  selectedLabel: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: Colors.text,
  },
  selectedSub: {
    fontSize: 11,
    fontFamily: "Inter-Regular",
    color: Colors.textMuted,
    marginTop: 1,
  },
  selectedValue: {
    fontSize: 28,
    fontFamily: "Inter-Bold",
  },
  selectedUnit: {
    fontSize: 13,
    fontFamily: "Inter-Medium",
    color: Colors.textMuted,
  },

  // Export row & buttons
  exportRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  exportBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  exportBtnOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  exportBtnDisabled: {
    opacity: 0.5,
  },
  exportText: {
    fontSize: 14,
    fontFamily: "Inter-Bold",
    color: Colors.textInverse,
  },
  exportTextOutline: {
    fontSize: 14,
    fontFamily: "Inter-Bold",
    color: Colors.primary,
  },
});

export default Analytics;
