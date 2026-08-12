import { chartRev, invoices, products } from "@/constants/data";
import { icons } from "@/constants/icons";
import { Colors } from "@/constants/theme";

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

const parseInvoiceDate = (value: string | number | Date | null | undefined) => {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getMonthlyInvoiceTotal = (
  sourceInvoices: {
    date?: string | number | Date | null;
    amount?: number | string | null;
  }[],
): number => {
  const datedInvoices = sourceInvoices
    .map((invoice) => ({ invoice, date: parseInvoiceDate(invoice.date) }))
    .filter(
      (
        item,
      ): item is {
        invoice: {
          date?: string | number | Date | null;
          amount?: number | string | null;
        };
        date: Date;
      } => item.date !== null,
    );

  if (datedInvoices.length === 0) {
    return 0;
  }

  const now = new Date();
  const currentMonthInvoices = datedInvoices.filter(
    ({ date }) =>
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear(),
  );

  const targetMonthInvoices =
    currentMonthInvoices.length > 0
      ? currentMonthInvoices
      : (() => {
          let latestInvoice = datedInvoices[0];

          for (const item of datedInvoices.slice(1)) {
            if (item.date.getTime() > latestInvoice.date.getTime()) {
              latestInvoice = item;
            }
          }

          return datedInvoices.filter(
            ({ date }) =>
              date.getMonth() === latestInvoice.date.getMonth() &&
              date.getFullYear() === latestInvoice.date.getFullYear(),
          );
        })();

  return targetMonthInvoices.reduce(
    (sum, { invoice }) => sum + getInvoiceAmount(invoice),
    0,
  );
};

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

// Monthly revenue (current calendar month, or the latest month in the dataset)
export const monthlyRevenue = getMonthlyInvoiceTotal(asArray(invoices));

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

const TrendUp = icons.trendup;
const TrendDown = icons.trenddown;
const AlertIcon = icons.alertcircle; // adjust to your actual icon name if different

// Existing-style function — day-over-day revenue change
export function getRevenueChange(today: number, yesterday: number) {
  if (yesterday === 0 && today === 0) {
    return { Icon: TrendUp, color: Colors.textMuted, value: "--" };
  }
  const diff = today - yesterday;
  const rawPercent = yesterday === 0 ? 100 : (diff / yesterday) * 100;
  const isUp = diff >= 0;

  // Clamp the displayed magnitude to 1-100%. A tiny real change (e.g.
  // 0.03%) would otherwise round to "0.0%" and look identical to no
  // change at all, and a huge one (common when `yesterday` is near zero)
  // could show something like "+2400.0%", which isn't meaningful at a
  // glance. A genuine zero difference (today === yesterday) is left at
  // 0% rather than floored to 1%, since that's "no change," not an
  // increase or decrease.
  const magnitude = Math.abs(rawPercent);
  const clampedMagnitude =
    diff === 0 ? 0 : Math.min(Math.max(magnitude, 1), 100);

  return {
    Icon: isUp ? TrendUp : TrendDown,
    color: isUp ? Colors.green : Colors.warning,
    value: `${diff === 0 ? "" : isUp ? "+" : "-"}${clampedMagnitude.toFixed(1)}%`,
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
