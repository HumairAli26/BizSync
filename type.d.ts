import type { LucideIcon } from "lucide-react-native";

declare global {
  interface AppTab {
    name: string;
    title: string;
    icon: LucideIcon;
  }

  interface TabIconProps {
    focused: boolean;
    icon: LucideIcon;
  }

  interface DashbordHeaderProps {
    greeting: string;
    name: string;
    userInitials: string;
    hasNotification: boolean;
  }

  interface StatCardsProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    iconBgColor: string;
    trend?: string;
    subtitle?: string;
    currency?: string;
  }

  interface SearchBarProps {
    placeholder: string;
    onSearch: (query: string) => void;
  }

  interface RevenueChartProps {
    period: string;
    data: {
      date: string;
      revenue: number;
      expense: number;
    }[];
    legend: {
      key: "revenue" | "expense";
      lable: string;
      color: string;
    };
  }

  interface UserData {
    name: string;
    email: string;
    orgId: string;
    orgName: string;
    orgCode: string;
    role: string;
  }

  interface ListHeadingProp {
    title: string;
    button: string;
  }

  type TransactionType = "credit" | "debit";
  type TransactionCategory =
    "invoice_payment" | "supplier_payment" | "inventory_restock";

  interface Transaction {
    id: string;
    title: string;
    subtitle: string;
    amount: number;
    currency: string;
    type: TransactionType;
    icon: LucideIcon;
    timestamp: string;
  }

  interface RecentTransactionsSectionProps {
    transactions: Transaction[];
    onSeeAll: () => void;
  }

  type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

  interface BestSellingProps {
    id: string;
    rank: number;
    icon: LucideIcon;
    productname: string;
    type: string;
    value: string | number;
    currency?: string;
    stockStatus: StockStatus;
  }
}
