export type Row = Record<string, unknown>;
export type CoreSection = keyof CRMData;
export type Section =
  | "today"
  | "inquiries"
  | "clients"
  | "tasks"
  | "cases"
  | "messages"
  | "approvals"
  | "chat"
  | "sales"
  | "calendar"
  | "deals"
  | "orders"
  | "productivity"
  | "team"
  | "automation"
  | "members"
  | "settings";
export type CRMData = Record<"clients" | "inquiries" | "tasks" | "cases", Row[]>;
export type LoadErrors = Partial<Record<keyof CRMData, string>>;
export type AccessState = "checking" | "allowed" | "denied" | "executive" | "error";

export type TableSource = { table: string; label: string };

export const sections: { id: Section; label: string; icon: string; adminOnly?: boolean; executiveOnly?: boolean }[] = [
  { id: "today", label: "Today", icon: "◷" },
  { id: "inquiries", label: "Inquiries", icon: "↗" },
  { id: "messages", label: "Messages", icon: "✉" },
  { id: "approvals", label: "Approvals", icon: "◉" },
  { id: "cases", label: "Cases", icon: "◇" },
  { id: "chat", label: "Chat", icon: "▤" },
  { id: "clients", label: "Clients", icon: "◎" },
  { id: "sales", label: "Sales", icon: "$" },
  { id: "tasks", label: "Tasks", icon: "✓" },
  { id: "calendar", label: "Calendar", icon: "▦" },
  { id: "deals", label: "Deals", icon: "◈" },
  { id: "orders", label: "Orders", icon: "▣" },
  { id: "productivity", label: "Productivity", icon: "◷" },
  { id: "team", label: "Team", icon: "♧", adminOnly: true },
  { id: "automation", label: "Automation", icon: "⟳", adminOnly: true },
  { id: "members", label: "Members", icon: "♙", adminOnly: true },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export const emptyData: CRMData = { clients: [], inquiries: [], tasks: [], cases: [] };

export const sectionTables: Partial<Record<Section, TableSource[]>> = {
  messages: [{ table: "crm_messages", label: "Inbox" }],
  approvals: [{ table: "crm_approvals", label: "Requests" }],
  chat: [{ table: "crm_team_messages", label: "Team messages" }],
  sales: [
    { table: "crm_accounts", label: "Accounts" },
    { table: "crm_leads", label: "Sales leads" },
    { table: "crm_opportunities", label: "Opportunities" },
    { table: "crm_quotes", label: "Quotes" },
    { table: "crm_invoices", label: "Invoices" },
    { table: "crm_payments", label: "Payments" },
  ],
  calendar: [
    { table: "crm_schedules", label: "Calendar" },
    { table: "crm_tasks", label: "Tasks" },
  ],
  deals: [
    { table: "crm_deals", label: "Deals" },
    { table: "crm_deal_stages", label: "Deal stages" },
  ],
  orders: [
    { table: "kloze_orders", label: "Orders" },
    { table: "kloze_products", label: "Products" },
  ],
  productivity: [{ table: "crm_presence_log", label: "Activity" }],
  team: [{ table: "crm_staff", label: "Team members" }],
  automation: [
    { table: "crm_routing_rules", label: "Routing rules" },
    { table: "crm_sla_policies", label: "SLA policies" },
    { table: "crm_report_schedules", label: "Scheduled reports" },
  ],
  members: [{ table: "crm_staff", label: "Members" }],
  settings: [
    { table: "crm_user_settings", label: "My preferences" },
    { table: "orchid_profiles", label: "Business profile" },
  ],
};

export function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isCoreSection(section: Section): section is CoreSection {
  return section === "clients" || section === "inquiries" || section === "tasks" || section === "cases";
}

export function rows(values: unknown): Row[] {
  return Array.isArray(values) ? values.filter(isRow) : [];
}

export function text(row: Row, key: string): string {
  const value = row[key];
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

export function displayDate(value: string): string {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateParts
    ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]))
    : new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

