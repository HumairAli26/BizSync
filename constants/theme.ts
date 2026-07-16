export const Colors = {
  // Backgrounds
  background: "#121212",
  surface: "#18181a",
  surface2: "#1f1f22",
  overlay: "#2a2a2d",

  // Text
  text: "#ffffff",
  textSecondary: "#b3b3b7",
  textMuted: "#8e8e93",
  textInverse: "#242424",

  // Brand
  primary: "#647652",
  primaryHover: "#d8e4cd",
  primaryActive: "#b8c6ac",

  // Accent
  accent: "#e68d4a",
  accentHover: "#f19a58",

  // Semantic
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#3b82f6",

  // Borders
  border: "#2b2b2d",
  borderLight: "#39393d",

  // Inputs
  input: "#1f1f22",
  ring: "#647652",

  // Charts
  chartSales: "#3b82f6",
  chartRevenue: "#22c55e",
  chartExpenses: "#f59e0b",
  chartCustomers: "#8b5cf6",
  chartReturns: "#ef4444",

  // Sidebar
  sidebar: "#18181a",
  sidebarText: "#ffffff",
  sidebarActive: "#647652",
  sidebarBorder: "#2b2b2d",
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 9999,
} as const;

export const Spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  4.5: 18,
  5: 20,
  5.5: 22,
  6: 24,
  6.5: 26,
  7: 28,
  7.5: 30,
  8: 32,
  8.5: 34,
  9: 36,
  9.5: 38,
  10: 40,
  10.5: 42,
  11: 44,
  11.5: 46,
  12: 48,
  13: 52,
  14: 56,
  15: 60,
  16: 64,
  17: 68,
  18: 72,
  19: 76,
  20: 80,
  21: 84,
  22: 88,
  23: 92,
  24: 96,

  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
} as const;

export const Shadow = {
  sm: {
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  md: {
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  lg: {
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
};

export const Status = {
  success: Colors.success,
  warning: Colors.warning,
  error: Colors.error,
  info: Colors.info,
} as const;

export const InventoryStatus = {
  inStock: Colors.success,
  lowStock: Colors.warning,
  outOfStock: Colors.error,
} as const;

export const InvoiceStatus = {
  paid: Colors.success,
  pending: Colors.warning,
  overdue: Colors.error,
  draft: Colors.textMuted,
} as const;

export const components = {
  tabBar: {
    height: Spacing[18],
    horizontalInset: Spacing[5],
    radius: Spacing[8],
    iconFrame: Spacing[12],
    itemPaddingVertical: Spacing[2],
  },
};

export const Theme = {
  colors: Colors,
  radius: Radius,
  spacing: Spacing,
  shadow: Shadow,
  status: Status,
  inventory: InventoryStatus,
  invoices: InvoiceStatus,
  components,
} as const;

export default Theme;
