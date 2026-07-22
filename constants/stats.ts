import { chartRev, invoices, products } from "@/constants/data";

type InvoiceLike =
  | {
      status?: string | null;
      amount?: number | string | null;
    }
  | null
  | undefined;

type ProductLike =
  | {
      stock?: number | string | null;
    }
  | null
  | undefined;

const asArray = <T>(value: T[] | null | undefined): T[] =>
  Array.isArray(value) ? value : [];

const toNumber = (value: number | string | null | undefined): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getInvoiceAmount = (invoice: InvoiceLike): number =>
  toNumber(invoice?.amount);
const isInvoiceStatus = (invoice: InvoiceLike, status: string): boolean =>
  invoice?.status === status;
const getProductStock = (product: ProductLike): number =>
  toNumber(product?.stock);

// Total products
export const totalProducts = asArray(products).length;

// Low stock (< 10)
export const lowStock = asArray(products).filter(
  (product) => getProductStock(product) > 0 && getProductStock(product) < 10,
).length;

// Out of stock
export const outOfStock = asArray(products).filter(
  (product) => getProductStock(product) === 0,
).length;

// Pending invoices
export const pendingInvoices = asArray(invoices).filter((invoice) =>
  isInvoiceStatus(invoice, "pending"),
).length;

// Total pending invoice amount
export const pendingAmount = asArray(invoices)
  .filter((invoice) => isInvoiceStatus(invoice, "pending"))
  .reduce((sum, invoice) => sum + getInvoiceAmount(invoice), 0);

// Total revenue (paid invoices)
export const totalRevenue = asArray(invoices)
  .filter((invoice) => isInvoiceStatus(invoice, "paid"))
  .reduce((sum, invoice) => sum + getInvoiceAmount(invoice), 0);

// Monthly revenue (latest point from the chart)
const revenueChartData = asArray(chartRev);
export const monthlyRevenue =
  revenueChartData.length > 0
    ? toNumber(revenueChartData[revenueChartData.length - 1]?.rev)
    : 0;

export const formatCurrencyValue = (
  value: number | string | null | undefined,
): string =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toNumber(value));

export const today = new Date();
export const yester = new Date(today);
yester.setDate(today.getDate() - 1);

const formatInvoiceDate = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const todayRevenue = invoices
  .filter((i) => i.date === formatInvoiceDate(today))
  .reduce((sum, i) => sum + getInvoiceAmount(i), 0);

export const yesterdayRevenue = invoices
  .filter((i) => i.date === formatInvoiceDate(yester))
  .reduce((sum, i) => sum + getInvoiceAmount(i), 0);

export const revenueData = chartRev.map((item) => ({
  x: item.m,
  y: item.rev,
}));

import { icons } from "@/constants/icons";
import { Colors } from "@/constants/theme";

const TrendUp = icons.trendup;
const TrendDown = icons.trenddown;
const AlertIcon = icons.alertcircle; // adjust to your actual icon name if different

// Existing-style function — day-over-day revenue change
export function getRevenueChange(today: number, yesterday: number) {
  if (yesterday === 0 && today === 0) {
    return { Icon: TrendUp, color: Colors.textMuted, value: "--" };
  }
  const diff = today - yesterday;
  const percent = yesterday === 0 ? 100 : (diff / yesterday) * 100;
  const isUp = diff >= 0;

  return {
    Icon: isUp ? TrendUp : TrendDown,
    color: isUp ? Colors.green : Colors.warning,
    value: `${isUp ? "+" : ""}${percent.toFixed(1)}%`,
  };
}

// Month-over-month revenue trend
export function getMonthlyRevenueChange(thisMonth: number, lastMonth: number) {
  if (lastMonth === 0 && thisMonth === 0) {
    return { Icon: TrendUp, color: Colors.textMuted, value: "--" };
  }
  const diff = thisMonth - lastMonth;
  const percent = lastMonth === 0 ? 100 : (diff / lastMonth) * 100;
  const isUp = diff >= 0;

  return {
    Icon: isUp ? TrendUp : TrendDown,
    color: isUp ? Colors.green : Colors.warning,
    value: `${isUp ? "+" : ""}${percent.toFixed(1)}% vs last month`,
  };
}

// Pending invoices — shows total amount still to be collected
export function getPendingInvoiceStatus(
  pendingCount: number,
  pendingAmount: number,
) {
  if (pendingCount === 0) {
    return { Icon: TrendUp, color: Colors.green, value: "0" };
  }
  return {
    Icon: AlertIcon,
    color: Colors.yellow,
    value: `$${pendingAmount.toFixed(2)}`,
  };
}

// Low stock — shows how many products are below a threshold
export function getLowStockStatus(lowStockCount: number) {
  if (lowStockCount === 0) {
    return { Icon: TrendUp, color: Colors.green, value: "--" };
  }
  return {
    Icon: AlertIcon,
    color: Colors.warning,
    value: `${lowStockCount}`,
  };
}
