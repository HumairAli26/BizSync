import {
  Bell,
  Box,
  ChartNoAxesColumn,
  FileText,
  House,
  Package,
  Settings,
} from "lucide-react-native";

export const icons = {
  bell: Bell,
  home: House,
  analytics: ChartNoAxesColumn,
  products: Package,
  invoices: FileText,
  settings: Settings,
  box: Box,
} as const;

export type icons = keyof typeof icons;
