import { chartRev, invoices, products } from "@/constants/data";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react-native";

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

export function getRevenueChange(today: number, yesterday: number) {
  if (yesterday === 0) {
    return {
      value: "0%",
      color: "#ffffff",
      Icon: Minus,
      positive: null,
    };
  }

  const change = ((today - yesterday) / yesterday) * 100;

  if (change > 0) {
    return {
      value: `+${change.toFixed(1)}%`,
      color: "#22c55e",
      Icon: ArrowUpRight,
      positive: true,
    };
  }

  if (change < 0) {
    return {
      value: `${change.toFixed(1)}%`,
      color: "#ef4444",
      Icon: ArrowDownRight,
      positive: false,
    };
  }

  return {
    value: "0%",
    color: "#9ca3af",
    Icon: Minus,
    positive: null,
  };
}

export const todayRevenue = invoices
  .filter((i) => i.date === formatInvoiceDate(today))
  .reduce((sum, i) => sum + getInvoiceAmount(i), 0);

export const yesterdayRevenue = invoices
  .filter((i) => i.date === formatInvoiceDate(yester))
  .reduce((sum, i) => sum + getInvoiceAmount(i), 0);


const revenueData = chartRev.map((item) => ({
  x: item.m,
  y: item.rev,
}));
