import {
  Bell,
  Box,
  ChartNoAxesColumn,
  FileText,
  House,
  Package,
  Search,
  Settings,
  TrendingUp,
} from "lucide-react-native";

export const icons = {
  bell: Bell,
  search: Search,
  home: House,
  trendup: TrendingUp,
  analytics: ChartNoAxesColumn,
  products: Package,
  invoices: FileText,
  settings: Settings,
  box: Box,
} as const;

export type icons = keyof typeof icons;
