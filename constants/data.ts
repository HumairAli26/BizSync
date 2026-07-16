import { icons } from "./icons";

const INF = "#0ea5e9";
const PUR = "#a855f7";
const ACC = "#14b8a6";
const SUC = "#22c55e";

export const tabs = [
  { name: "index", title: "Home", icons: icons.home },
  { name: "products", title: "Products", icons: icons.products },
  { name: "invoices", title: "Invoices", icons: icons.invoices },
  { name: "analytics", title: "Analytics", icons: icons.analytics },
  { name: "settings", title: "Settings", icons: icons.settings },
] as const;

export const chartRev = [
  { m: "Jan", rev: 42, exp: 28, sal: 38 },
  { m: "Feb", rev: 38, exp: 25, sal: 45 },
  { m: "Mar", rev: 55, exp: 31, sal: 62 },
  { m: "Apr", rev: 48, exp: 27, sal: 55 },
  { m: "May", rev: 62, exp: 35, sal: 71 },
  { m: "Jun", rev: 71, exp: 38, sal: 84 },
  { m: "Jul", rev: 68, exp: 40, sal: 79 },
];

export const chartWk = [
  { d: "Mon", n: 24 },
  { d: "Tue", n: 38 },
  { d: "Wed", n: 31 },
  { d: "Thu", n: 45 },
  { d: "Fri", n: 52 },
  { d: "Sat", n: 41 },
  { d: "Sun", n: 18 },
];

export const products = [
  {
    id: 1,
    name: "Wireless Earbuds Pro",
    sku: "WEP-001",
    cat: "Electronics",
    price: 89.99,
    stock: 124,
    status: "healthy",
  },
  {
    id: 2,
    name: "Leather Wallet",
    sku: "LW-023",
    cat: "Accessories",
    price: 45.0,
    stock: 8,
    status: "low",
  },
  {
    id: 3,
    name: "Running Shoes X3",
    sku: "RSX-088",
    cat: "Footwear",
    price: 129.99,
    stock: 2,
    status: "critical",
  },
  {
    id: 4,
    name: "Coffee Maker Elite",
    sku: "CME-045",
    cat: "Appliances",
    price: 249.99,
    stock: 37,
    status: "healthy",
  },
  {
    id: 5,
    name: "Yoga Mat Premium",
    sku: "YMP-012",
    cat: "Sports",
    price: 39.99,
    stock: 0,
    status: "out",
  },
  {
    id: 6,
    name: "Smart Watch Series 4",
    sku: "SWS-004",
    cat: "Electronics",
    price: 349.99,
    stock: 15,
    status: "low",
  },
];

export const invoices = [
  {
    id: "INV-2024-001",
    customer: "Apex Retail Ltd.",
    amount: 4850.0,
    date: "Jul 10, 2024",
    status: "paid",
  },
  {
    id: "INV-2024-002",
    customer: "Metro Supplies Co.",
    amount: 12300.0,
    date: "Jul 8, 2024",
    status: "pending",
  },
  {
    id: "INV-2024-003",
    customer: "Sunrise Traders",
    amount: 3200.0,
    date: "Jun 28, 2024",
    status: "overdue",
  },
  {
    id: "INV-2024-004",
    customer: "Global Distributors",
    amount: 8900.0,
    date: "Jul 11, 2024",
    status: "draft",
  },
  {
    id: "INV-2024-005",
    customer: "City Mart Group",
    amount: 2150.0,
    date: "Jul 9, 2024",
    status: "paid",
  },
];

export const customers = [
  {
    id: 1,
    name: "Sarah Johnson",
    email: "sarah@apexretail.com",
    orders: 24,
    spent: 18450,
    init: "SJ",
    clr: INF,
  },
  {
    id: 2,
    name: "Marcus Chen",
    email: "m.chen@metro.com",
    orders: 18,
    spent: 12300,
    init: "MC",
    clr: PUR,
  },
  {
    id: 3,
    name: "Priya Patel",
    email: "priya@sunrise.in",
    orders: 31,
    spent: 24800,
    init: "PP",
    clr: ACC,
  },
  {
    id: 4,
    name: "David Williams",
    email: "dwilliams@global.com",
    orders: 9,
    spent: 7200,
    init: "DW",
    clr: SUC,
  },
];

export const txns = [
  {
    id: 1,
    name: "Apex Retail Ltd.",
    desc: "Invoice payment",
    amt: 4850,
    time: "2h ago",
    pos: true,
  },
  {
    id: 2,
    name: "Supplier Payment",
    desc: "TechParts Inc.",
    amt: 2100,
    time: "5h ago",
    pos: false,
  },
  {
    id: 3,
    name: "City Mart Group",
    desc: "Invoice payment",
    amt: 2150,
    time: "8h ago",
    pos: true,
  },
  {
    id: 4,
    name: "Inventory Restock",
    desc: "Running Shoes X3",
    amt: 5800,
    time: "1d ago",
    pos: false,
  },
  {
    id: 5,
    name: "Metro Supplies",
    desc: "Invoice payment",
    amt: 12300,
    time: "1d ago",
    pos: true,
  },
];
