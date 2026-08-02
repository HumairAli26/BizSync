import { icons } from "./icons";

export const tabs = [
  { name: "index", title: "Home", icons: icons.home },
  { name: "products", title: "Products", icons: icons.products },
  { name: "invoices", title: "Invoices", icons: icons.invoices },
  { name: "customers", title: "Customers", icons: icons.users },
  { name: "analytics", title: "Analytics", icons: icons.analytics },
  { name: "quotations", title: "Quotations", icons: icons.dollarsign },
] as const;
