import { icons } from "./icons";

export const tabs = [
  { name: "index", title: "Home", icons: icons.home },
  { name: "products", title: "Products", icons: icons.products },
  { name: "invoices", title: "Invoices", icons: icons.invoices },
  { name: "analytics", title: "Analytics", icons: icons.analytics },
  { name: "settings", title: "Settings", icons: icons.settings },
] as const;
