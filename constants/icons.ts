import {
  Bell,
  Box,
  ChartNoAxesColumn,
  DollarSign,
  FileText,
  House,
  MoveDownRight,
  MoveUpRight,
  Package,
  Search,
  Settings,
  TrendingUp,
} from "lucide-react-native";

export const icons = {
  bell: Bell,
  dollarsign: DollarSign,
  search: Search,
  home: House,
  trendup: TrendingUp,
  analytics: ChartNoAxesColumn,
  products: Package,
  invoices: FileText,
  settings: Settings,
  box: Box,
  moveupright: MoveUpRight,
  movedownright: MoveDownRight,
} as const;

export type icons = keyof typeof icons;
