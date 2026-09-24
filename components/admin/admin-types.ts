import type { Product } from "../../lib/content-store";

export type { Product };

export const PAGE_SIZE = 10;

export const STATUSES = ["pending", "paid", "fulfilled", "cancelled"] as const;

// Tab ORDER mirrors the app's AdminScreen exactly (guide/ARCHITECTURE.md B-6 —
// app is the reference order; pinned by tests/admin-parity.test.ts). U-23
// (2026-09-24): grouped order — store rows first, then editorial, people,
// finance, activity, settings.
export const TABS = [
  "Dashboard",
  "Orders",
  "Products",
  "Projects",
  "Services",
  "Journal",
  "Content",
  "Users",
  "Messages",
  "Finance",
  "Activity",
  "Settings",
] as const;
export type Tab = (typeof TABS)[number];

// U-23 (2026-09-24): admin tab sub-groups (owner order decision) — rendered
// as separators on the web tab strip; app mirrors the flat TABS order.
export const ADMIN_TAB_GROUPS: { label: string; tabs: readonly Tab[] }[] = [
  { label: "Store", tabs: ["Dashboard", "Orders", "Products", "Projects", "Services"] },
  { label: "Editorial", tabs: ["Journal", "Content"] },
  { label: "People", tabs: ["Users", "Messages"] },
  { label: "Finance", tabs: ["Finance"] },
  { label: "Activity", tabs: ["Activity"] },
  { label: "Settings", tabs: ["Settings"] },
];

export const TAB_GROUP_OF: Record<Tab, string> = Object.fromEntries(
  ADMIN_TAB_GROUPS.flatMap((g) => g.tabs.map((tab) => [tab, g.label]))
) as Record<Tab, string>;

export type Order = {
  id: string;
  items: { name: string; quantity: number; price: number }[];
  totalNpr: number;
  status: string;
  provider: string;
  customerName: string;
  email: string;
  address: string;
  createdAt: string;
};

export type OrderPage = { orders: Order[]; total: number; page: number; totalPages: number };

export type ManagedUser = {
  id: string;
  email: string;
  name: string;
  phone: string;
  address: string;
  role: string;
  tier?: string;
  createdAt: string;
  lastSignInAt: string | null;
};

export type UserPage = { users: ManagedUser[]; page: number; hasMore: boolean };

export type DashboardStats = {
  totalUsers: number;
  newUsersToday: number;
  totalCartItems: number;
  activeCarts: number;
  totalOrders: number;
  pendingOrders: number;
  paidOrders: number;
  fulfilledOrders: number;
  cancelledOrders: number;
  revenue: number;
  revenueToday: number;
  totalProducts: number;
  lowStockProducts: number;
  totalMessages: number;
  unreadMessages: number;
  totalTransactions: number;
  succeededTransactions: number;
};

export type Service = {
  id: string;
  name: string;
  category: string;
  priceLabel: string;
  description: string;
  tag: string;
  sortOrder: number;
  active: boolean;
};

export type ActivityEntry = {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

export type Message = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
};

export type PageViewStat = { path: string; count: number; uniqueUsers: number };

export type Analytics = {
  totalViews: number;
  todayViews: number;
  topPaths: PageViewStat[];
  viewsByDay: { date: string; count: number }[];
};

export const emptyProduct: Product = {
  id: "",
  name: "",
  category: "Controllers & Boards",
  price: 0,
  priceLabel: "Request quote",
  sku: "",
  productType: "Retail kit",
  note: "",
  description: "",
  specs: [],
  audience: "Students, schools, hobbyists, and makers",
  difficulty: "Beginner",
  warranty: "7-day component replacement for manufacturing defects",
  stock: 0,
  delivery: "Ships in 1-2 working days",
  color: "from-[#dce8ff] to-[#7e9ff2]",
  image: "",
  gallery: [],
  importMeta: {},
};

export const emptyService: Service = {
  id: "",
  name: "",
  category: "General",
  priceLabel: "Request quote",
  description: "",
  tag: "",
  sortOrder: 1000,
  active: true,
};

export type JournalItem = {
  id: string;
  tag: string;
  title: string;
  text: string;
  active: boolean;
  sortOrder: number;
};

export const emptyJournal: JournalItem = {
  id: "",
  tag: "",
  title: "",
  text: "",
  active: true,
  sortOrder: 0,
};

export const fields = [
  "id",
  "name",
  "category",
  "sku",
  "price",
  "priceLabel",
  "stock",
  "note",
  "description",
] as const;
