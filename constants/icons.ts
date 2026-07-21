import {
  AlertCircle,
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
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react-native";

export const icons = {
  bell: Bell,
  users: Users,
  dollarsign: DollarSign,
  search: Search,
  home: House,
  trendup: TrendingUp,
  analytics: ChartNoAxesColumn,
  products: Package,
  invoices: FileText,
  settings: Settings,
  box: Box,
  alertcircle: AlertCircle,
  trenddown: TrendingDown,
  moveupright: MoveUpRight,
  movedownright: MoveDownRight,
} as const;

export type icons = keyof typeof icons;
