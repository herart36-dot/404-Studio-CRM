"use client";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

type Row = Record<string, unknown>;
type CoreSection = keyof CRMData;
type Section =
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
type CRMData = Record<"clients" | "inquiries" | "tasks" | "cases", Row[]>;
type LoadErrors = Partial<Record<keyof CRMData, string>>;
type AccessState = "checking" | "allowed" | "denied" | "executive" | "error";

type TableSource = { table: string; label: string };

const sections: { id: Section; label: string; icon: string; adminOnly?: boolean; executiveOnly?: boolean }[] = [
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

const emptyData: CRMData = { clients: [], inquiries: [], tasks: [], cases: [] };

const sectionTables: Partial<Record<Section, TableSource[]>> = {
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

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCoreSection(section: Section): section is CoreSection {
  return section === "clients" || section === "inquiries" || section === "tasks" || section === "cases";
}

function rows(values: unknown): Row[] {
  return Array.isArray(values) ? values.filter(isRow) : [];
}

function text(row: Row, key: string): string {
  const value = row[key];
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function displayDate(value: string): string {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateParts
    ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]))
    : new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

export default function CRMApp() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [activeSection, setActiveSection] = useState<Section>("today");
  const [data, setData] = useState<CRMData>(emptyData);
  const [loadErrors, setLoadErrors] = useState<LoadErrors>({});
  const [moduleData, setModuleData] = useState<Record<string, Row[]>>({});
  const [moduleErrors, setModuleErrors] = useState<Record<string, string>>({});
  const [moduleLoading, setModuleLoading] = useState(false);
  const [activeTable, setActiveTable] = useState("");
  const [moduleRefresh, setModuleRefresh] = useState(0);
  const [editingClient, setEditingClient] = useState<Row | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setError("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to connect this CRM to Supabase.");
      setLoading(false);
      return;
    }

    const supabase = createClient(url, key);
    setClient(supabase);
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setRole("");
        setIsAdmin(false);
        setAccessState("checking");
        setData(emptyData);
        setLoading(false);
      }
    });

    void supabase.auth.getSession().then(({ data: sessionData, error: sessionError }) => {
      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }
      setUser(sessionData.session?.user ?? null);
      setLoading(false);
    });

    return () => auth.subscription.unsubscribe();
  }, []);

  const loadCRM = useCallback(async (supabase: SupabaseClient) => {
    setLoading(true);
    setError("");
    setAccessState("checking");
    const [roleResult, adminResult] = await Promise.all([
      supabase.rpc("crm_role"),
      supabase.rpc("crm_is_admin"),
    ]);
    if (roleResult.error || adminResult.error) {
      setAccessState("error");
      setError(roleResult.error
        ? `Could not check your CRM role: ${roleResult.error.message}`
        : `Could not check administrator access: ${adminResult.error?.message ?? "Unknown error"}`);
      setLoading(false);
      return;
    }

    const resolvedRole = typeof roleResult.data === "string" ? roleResult.data : "";
    const resolvedAdmin = adminResult.data === true;
    setRole(resolvedRole);
    setIsAdmin(resolvedAdmin);
    if (resolvedRole === "executive") {
      setAccessState("allowed");
      setData(emptyData);
      setLoading(false);
      return;
    }
    if (!resolvedAdmin && resolvedRole !== "staff") {
      setAccessState("denied");
      setData(emptyData);
      setLoading(false);
      return;
    }

    setAccessState("allowed");
    const [clients, inquiries, tasks, cases] = await Promise.all([
      supabase.from("crm_clients").select("*").order("name"),
      supabase.from("crm_inquiries").select("*").order("created_at", { ascending: false }),
      supabase.from("crm_tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("crm_cases").select("*").order("created_at", { ascending: false }),
    ]);

    const nextData: CRMData = {
      clients: rows(clients.data),
      inquiries: rows(inquiries.data),
      tasks: rows(tasks.data),
      cases: rows(cases.data),
    };
    const nextErrors: LoadErrors = {};
    if (clients.error) nextErrors.clients = clients.error.message;
    if (inquiries.error) nextErrors.inquiries = inquiries.error.message;
    if (tasks.error) nextErrors.tasks = tasks.error.message;
    if (cases.error) nextErrors.cases = cases.error.message;
    setData(nextData);
    setLoadErrors(nextErrors);
    setLoading(false);
  }, []);

  const safelyLoadCRM = useCallback(async (supabase: SupabaseClient) => {
    try {
      await loadCRM(supabase);
    } catch (loadError) {
      setError(errorMessage(loadError));
      setAccessState("error");
      setLoading(false);
    }
  }, [loadCRM]);

  useEffect(() => {
    if (!client || !user) return;
    void safelyLoadCRM(client);
  }, [client, user, safelyLoadCRM]);

  useEffect(() => {
    if (role === "executive" && activeSection !== "orders") {
      setActiveSection("orders");
      setActiveTable("kloze_orders");
    }
  }, [activeSection, role]);

  useEffect(() => {
    const sources = sectionTables[activeSection];
    if (!client || !user || !sources) return;
    let cancelled = false;
    setModuleLoading(true);
    setModuleErrors({});
    void Promise.all(sources.map(async ({ table }) => {
      const result = await client.from(table).select("*").limit(200);
      return { table, rows: rows(result.data), error: result.error?.message };
    })).then((results) => {
      if (cancelled) return;
      const nextData: Record<string, Row[]> = {};
      const nextErrors: Record<string, string> = {};
      for (const result of results) {
        nextData[result.table] = result.rows;
        if (result.error) nextErrors[result.table] = result.error;
      }
      setModuleData((existing) => ({ ...existing, ...nextData }));
      setModuleErrors(nextErrors);
      setModuleLoading(false);
    }).catch((loadError: unknown) => {
      if (cancelled) return;
      setModuleErrors(Object.fromEntries(sources.map(({ table }) => [table, errorMessage(loadError)])));
      setModuleLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeSection, client, moduleRefresh, user]);

  const filteredRows = useMemo(() => {
    const sources = sectionTables[activeSection];
    const selectedTable = activeTable || sources?.[0]?.table;
    const source = isCoreSection(activeSection)
      ? data[activeSection as keyof CRMData]
      : selectedTable ? moduleData[selectedTable] ?? [] : [];
    const query = search.trim().toLocaleLowerCase();
    if (!query) return source;
    return source.filter((row) =>
      Object.values(row).some(
        (value) => (typeof value === "string" || typeof value === "number") &&
          String(value).toLocaleLowerCase().includes(query),
      ),
    );
  }, [activeSection, activeTable, data, moduleData, search]);

  async function signIn() {
    if (!client) return;
    setSigningIn(true);
    setError("");
    const { error: signInError } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (signInError) {
      setError(signInError.message);
      setSigningIn(false);
    }
  }

  async function signOut() {
    if (!client) return;
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) setError(signOutError.message);
  }

  async function updateInquiryStatus(row: Row, status: string) {
    if (!client || typeof row.id !== "string") return;
    if (!isAdmin) {
      if (status === text(row, "status")) return;
      const summary = `Change status of "${text(row, "name") || "inquiry"}" from ${text(row, "status")} to ${status}`;
      const { error: requestError } = await client.from("crm_approvals").insert({
        requested_by: user?.email?.toLowerCase(),
        action: "inq_status",
        target_id: row.id,
        summary: summary.slice(0, 600),
        payload: { status },
      });
      if (requestError) {
        setError(requestError.message);
        return;
      }
      setNotice("Status change sent to an administrator for approval.");
      setModuleRefresh((current) => current + 1);
      return;
    }
    setError("");
    setNotice("");
    const now = new Date().toISOString();
    const patch: Row = { status, last_touch: now };
    if (status !== "new" && !text(row, "contacted_at")) patch.contacted_at = now;
    const { error: updateError } = await client.from("crm_inquiries").update(patch).eq("id", row.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNotice("Inquiry status updated.");
    await safelyLoadCRM(client);
  }

  async function saveClient(formData: FormData) {
    if (!client) return;
    const values = {
      name: String(formData.get("name") ?? "").trim(),
      company: String(formData.get("company") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    };
    if (!values.name) {
      setError("Client name is required.");
      return;
    }
    const existing = editingClient;
    const query = existing && typeof existing.id === "string"
      ? client.from("crm_clients").update(values).eq("id", existing.id)
      : client.from("crm_clients").insert(values);
    const { error: saveError } = await query;
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setEditingClient(undefined);
    setNotice(existing ? "Client updated." : "Client added.");
    await safelyLoadCRM(client);
  }

  async function updateCase(row: Row, patch: Row) {
    if (!client || typeof row.id !== "string") return;
    setError("");
    setNotice("");
    const { error: updateError } = await client.from("crm_cases").update(patch).eq("id", row.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNotice("Case updated.");
    await safelyLoadCRM(client);
  }

  async function decideApproval(row: Row, approve: boolean) {
    if (!client || !isAdmin || row.status !== "pending" || typeof row.id !== "string") return;
    setError("");
    setNotice("");
    if (approve) {
      const payload = isRow(row.payload) ? row.payload : {};
      const values = isRow(payload.values) ? payload.values : {};
      const targetId = text(row, "target_id");
      const action = text(row, "action");
      let operation: { error: { message: string } | null } | null = null;
      if (action === "inq_status") {
        const allowed = ["new", "contacted", "quoted", "won", "lost"];
        const status = text(payload, "status");
        if (!allowed.includes(status) || !targetId) {
          setError("This inquiry-status approval has invalid data.");
          return;
        }
        const now = new Date().toISOString();
        const inquiry = data.inquiries.find((item) => text(item, "id") === targetId);
        operation = await client.from("crm_inquiries")
          .update({
            status,
            last_touch: now,
            ...(status !== "new" && inquiry && !text(inquiry, "contacted_at") ? { contacted_at: now } : {}),
          })
          .eq("id", targetId);
      } else if (action === "inq_touch" && targetId) {
        operation = await client.from("crm_inquiries").update({ last_touch: new Date().toISOString() }).eq("id", targetId);
      } else if (action === "inq_edit" && targetId) {
        if (isRow(payload.custom) && Object.keys(payload.custom).length > 0) {
          setError("This request also changes custom fields, which are not supported by this approval screen yet.");
          return;
        }
        const allowed = ["name", "email", "phone", "service", "concern", "notes", "deal_value", "follow_up_on", "appointment_at", "status"];
        const patch = Object.fromEntries(Object.entries(values).filter(([key]) => allowed.includes(key)));
        if (Object.keys(patch).length === 0) {
          setError("This inquiry edit contains no supported fields.");
          return;
        }
        operation = await client.from("crm_inquiries").update(patch).eq("id", targetId);
      } else if (action === "inq_delete" && targetId) {
        operation = await client.from("crm_inquiries").delete().eq("id", targetId);
      } else if (action === "task_add") {
        if (text(payload, "assigned") || (isRow(payload.custom) && Object.keys(payload.custom).length > 0)) {
          setError("This task request includes assignment or custom fields that are not supported by this approval screen yet.");
          return;
        }
        const title = text(values, "title").trim();
        if (!title) {
          setError("This task request has no title.");
          return;
        }
        operation = await client.from("crm_tasks").insert({
          title,
          due_date: text(values, "due_date") || null,
          priority: ["low", "normal", "high"].includes(text(values, "priority")) ? text(values, "priority") : "normal",
          client_id: text(values, "client_id") || null,
        });
      } else if (action === "task_delete" && targetId) {
        operation = await client.from("crm_tasks").delete().eq("id", targetId);
      } else {
        setError(`The "${action || "unknown"}" approval action has not been migrated yet. It remains pending and unchanged.`);
        return;
      }
      if (operation?.error) {
        setError(operation.error.message);
        return;
      }
      if (!operation) {
        setError("This approval action is not supported.");
        return;
      }
    }
    const { error: decisionError } = await client
      .from("crm_approvals")
      .update({
        status: approve ? "approved" : "rejected",
        decided_by: user?.email?.toLowerCase() ?? "",
        decided_at: new Date().toISOString(),
        note: null,
      })
      .eq("id", row.id)
      .eq("status", "pending");
    if (decisionError) {
      setError(`The requested change was applied, but the approval record could not be updated: ${decisionError.message}`);
      return;
    }
    setNotice(approve ? "Request approved and applied." : "Request declined.");
    setModuleRefresh((current) => current + 1);
    await safelyLoadCRM(client);
  }

  async function toggleTask(row: Row) {
    if (!client || typeof row.id !== "string" || typeof row.done !== "boolean") return;
    setError("");
    setNotice("");
    const { error: updateError } = await client
      .from("crm_tasks")
      .update({ done: !row.done })
      .eq("id", row.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNotice(row.done ? "Task reopened." : "Task completed.");
    await safelyLoadCRM(client);
  }

  async function addTask(formData: FormData) {
    if (!client || !user) return;
    setError("");
    setNotice("");
    const title = String(formData.get("title") ?? "").trim();
    if (!title) {
      setError("Enter a task title.");
      return;
    }
    const dueDate = String(formData.get("due_date") ?? "");
    const values = {
      title,
      due_date: dueDate || null,
      priority: String(formData.get("priority") ?? "normal"),
      client_id: String(formData.get("client_id") ?? "") || null,
    };
    if (!isAdmin) {
      const { error: requestError } = await client.from("crm_approvals").insert({
        requested_by: user.email?.toLowerCase(),
        action: "task_add",
        target_id: null,
        summary: `Add the task "${title}"${values.due_date ? ` · due ${values.due_date}` : ""}`.slice(0, 600),
        payload: { values, assigned: "" },
      });
      if (requestError) {
        setError(requestError.message);
        return;
      }
      setNotice("Task request sent to an administrator for approval.");
      setActiveSection("approvals");
      setModuleRefresh((current) => current + 1);
      return;
    }
    const { error: insertError } = await client.from("crm_tasks").insert({ ...values, done: false });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNotice("Task created.");
    setActiveSection("tasks");
    await safelyLoadCRM(client);
  }

  async function sendTeamMessage(formData: FormData) {
    if (!client || !user?.email) return;
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    if (body.length > 4000) {
      setError("Messages must be 4,000 characters or fewer.");
      return;
    }
    setError("");
    setNotice("");
    const { error: sendError } = await client.from("crm_team_messages").insert({
      sender_email: user.email.toLowerCase(),
      body,
    });
    if (sendError) {
      setError(sendError.message);
      return;
    }
    setNotice("Message sent.");
    setModuleRefresh((current) => current + 1);
  }

  if (loading && !client) return <div className="loading-screen">Loading Hellobase…</div>;
  if (!user) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <div className="brand-mark">h<span>.</span></div>
          <p className="eyebrow">HELLOBASE CRM</p>
          <h1>A calmer way to run your business.</h1>
          <p className="login-copy">Keep inquiries, clients, and daily work in one clear place.</p>
          {error && <div className="alert error" role="alert">{error}</div>}
          <button className="google-button" disabled={signingIn || !client} onClick={() => void signIn()}>
            <span className="google-g">G</span>
            {signingIn ? "Connecting to Google…" : "Continue with Google"}
          </button>
          <p className="login-foot">Authorized team members only</p>
        </section>
        <div className="login-orbit orbit-one" />
        <div className="login-orbit orbit-two" />
      </main>
    );
  }

  if (accessState === "denied" || accessState === "error") {
    return (
      <main className="login-screen">
        <section className="login-card access-card">
          <div className="brand-mark">h<span>.</span></div>
          <p className="eyebrow">HELLOBASE CRM</p>
          <h1>{accessState === "error" ? "We couldn't verify your access." : "This account doesn't have CRM access."}</h1>
          <p className="login-copy">
            {accessState === "error"
              ? error || "The CRM access check failed. Try again or contact your administrator."
              : `Ask an administrator to add ${user.email ?? "your account"} to the CRM.`}
          </p>
          {accessState === "error" && client && <button className="secondary-button" onClick={() => void safelyLoadCRM(client)}>Try again</button>}
          <button className="signout-link" onClick={() => void signOut()}>Sign out</button>
        </section>
      </main>
    );
  }

  if (accessState !== "allowed") return <div className="loading-screen">Checking CRM access…</div>;

  const visibleSections = sections.filter((section) => {
    if (section.adminOnly && !isAdmin) return false;
    if (role === "executive") return section.id === "orders";
    return true;
  });
  const currentSection = visibleSections.find((section) => section.id === activeSection) ?? visibleSections[0];
  const tableSources = sectionTables[activeSection];
  const activeSource = tableSources?.find((source) => source.table === activeTable) ?? tableSources?.[0];
  const activeModuleError = activeSource ? moduleErrors[activeSource.table] : undefined;
  const activeCoreSection = isCoreSection(activeSection) ? activeSection : "clients";
  const activeCoreError = isCoreSection(activeSection) ? loadErrors[activeSection] : undefined;
  const openTasks = data.tasks.filter((task) => task.done !== true).length;
  const newInquiries = data.inquiries.filter((inquiry) => text(inquiry, "status") === "new").length;

  return (
    <main className="crm-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Hellobase home">
          <span className="brand-mark small">h<span>.</span></span>
          <span className="brand-name">hellobase</span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="CRM sections">
          {visibleSections.map((section) => (
            <button
              className={`nav-item${activeSection === section.id ? " active" : ""}`}
              key={section.id}
              onClick={() => {
                setActiveSection(section.id);
                setActiveTable(sectionTables[section.id]?.[0]?.table ?? "");
                setSearch("");
                setError("");
                setNotice("");
              }}
            >
              <span className="nav-icon">{section.icon}</span>
              <span>{section.label}</span>
              {section.id === "inquiries" && newInquiries > 0 && <span className="nav-count">{newInquiries}</span>}
              {section.id === "tasks" && openTasks > 0 && <span className="nav-count">{openTasks}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="online-dot" />
          <span className="connection-label">Connected</span>
          <button className="icon-button refresh-button" onClick={() => {
            if (sectionTables[activeSection]) setModuleRefresh((current) => current + 1);
            else if (client) void safelyLoadCRM(client);
          }} aria-label="Refresh CRM data">↻</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>{currentSection.label}</strong></div>
          <div className="topbar-actions">
            <span className="role-chip">{role || "Member"}</span>
            <button className="avatar-button" title={user.email ?? "Account"} onClick={() => void signOut()}>
              {(user.email?.[0] ?? "U").toUpperCase()}
            </button>
          </div>
        </header>

        <div className="page-content">
          {(error || notice) && (
            <div className={`alert ${error ? "error" : "success"}`} role={error ? "alert" : "status"}>
              <span>{error || notice}</span>
              <button className="alert-close" onClick={() => { setError(""); setNotice(""); }} aria-label="Dismiss">×</button>
            </div>
          )}

          {activeSection === "today" ? (
            <Overview
              clients={data.clients}
              inquiries={data.inquiries}
              tasks={data.tasks}
              onNavigate={setActiveSection}
              onToggleTask={toggleTask}
              loadErrors={loadErrors}
              loading={loading}
            />
          ) : tableSources ? (
            <section>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">YOUR WORKSPACE</p>
                  <h1>{currentSection.label}</h1>
                  <p className="page-subtitle">
                    {activeModuleError
                      ? "This data source could not be loaded."
                      : `${filteredRows.length} ${filteredRows.length === 1 ? "record" : "records"}`}
                  </p>
                </div>
                <div className="heading-actions">
                  {activeSection === "chat" && <ChatComposer onSubmit={sendTeamMessage} />}
                  <input
                    className="search-input"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={`Search ${currentSection.label.toLowerCase()}…`}
                    aria-label={`Search ${currentSection.label.toLowerCase()}`}
                  />
                </div>
              </div>
              <nav className="module-tabs" aria-label={`${currentSection.label} data`}>
                {tableSources.map((source) => (
                  <button
                    key={source.table}
                    className={`module-tab${activeSource?.table === source.table ? " selected" : ""}`}
                    onClick={() => { setActiveTable(source.table); setSearch(""); }}
                  >
                    {source.label}
                    {moduleData[source.table] && <span>{moduleData[source.table].length}</span>}
                  </button>
                ))}
              </nav>
              {activeModuleError ? (
                <div className="empty-state">
                  <strong>Could not load {activeSource?.label.toLowerCase()}</strong>
                  <span>{activeModuleError}</span>
                </div>
              ) : moduleLoading && !moduleData[activeSource?.table ?? ""] ? (
                <div className="empty-state">Loading {activeSource?.label.toLowerCase()}…</div>
              ) : filteredRows.length === 0 ? (
                <div className="empty-state">
                  <strong>{search ? "No matching records" : `No ${activeSource?.label.toLowerCase()} yet`}</strong>
                  <span>{search ? "Try a different search." : "Records will appear here when they are available in Supabase."}</span>
                </div>
              ) : (
                activeSection === "messages" ? (
                  <MessageCenter
                    rows={filteredRows}
                    loading={moduleLoading}
                    onAction={async (row, patch) => {
                      if (!client || typeof row.id !== "string") return;
                      const { error: actionError } = await client.from("crm_messages").update(patch).eq("id", row.id);
                      if (actionError) {
                        setError(actionError.message);
                        return;
                      }
                      setNotice("Message updated.");
                      setModuleRefresh((current) => current + 1);
                    }}
                  />
                ) : activeSection === "approvals" ? (
                  <ApprovalsList rows={filteredRows} isAdmin={isAdmin} onDecision={decideApproval} />
                ) : (
                  <ModuleRecords
                    rows={filteredRows}
                    loading={moduleLoading}
                    section={activeSection}
                  />
                )
              )}
            </section>
          ) : (
            <section>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">YOUR WORKSPACE</p>
                  <h1>{currentSection.label}</h1>
                  <p className="page-subtitle">
                    {activeCoreError
                      ? "This section could not be loaded from Supabase."
                      : `${filteredRows.length} ${filteredRows.length === 1 ? "record" : "records"}`}
                  </p>
                </div>
                <div className="heading-actions">
                  {activeSection === "tasks" && <TaskForm onSubmit={addTask} />}
                  {activeSection === "clients" && <button className="primary-button" onClick={() => setEditingClient(null)}>+ New client</button>}
                  <input
                    className="search-input"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={`Search ${currentSection.label.toLowerCase()}…`}
                    aria-label={`Search ${currentSection.label.toLowerCase()}`}
                  />
                </div>
              </div>
              {activeCoreError ? (
                <div className="empty-state">
                  <strong>Could not load {currentSection.label.toLowerCase()}</strong>
                  <span>{activeCoreError}</span>
                </div>
              ) : loading ? (
                <div className="empty-state">Loading records…</div>
              ) : filteredRows.length === 0 ? (
                <div className="empty-state">
                  <strong>{search ? "No matching records" : `No ${currentSection.label.toLowerCase()} yet`}</strong>
                  <span>{search ? "Try a different search." : "New records will appear here when they are added to your CRM."}</span>
                </div>
              ) : (
                <RecordTable
                  section={activeCoreSection}
                  data={filteredRows}
                  isAdmin={isAdmin}
                  onInquiryStatus={updateInquiryStatus}
                  onToggleTask={toggleTask}
                  onClientEdit={activeSection === "clients" ? setEditingClient : undefined}
                  onCaseUpdate={updateCase}
                />
              )}
            </section>
          )}
        </div>
      </section>
      {activeSection === "clients" && editingClient !== undefined && (
        <ClientEditor client={editingClient} onClose={() => setEditingClient(undefined)} onSubmit={saveClient} />
      )}
    </main>
  );
}

function Overview({
  clients,
  inquiries,
  tasks,
  onNavigate,
  onToggleTask,
  loadErrors,
  loading,
}: {
  clients: Row[];
  inquiries: Row[];
  tasks: Row[];
  onNavigate: (section: Section) => void;
  onToggleTask: (row: Row) => void;
  loadErrors: LoadErrors;
  loading: boolean;
}) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const dueToday = tasks.filter((task) => text(task, "due_date").slice(0, 10) === today && task.done !== true);
  const recentInquiries = inquiries.slice(0, 5);
  const recentClients = clients.slice(0, 5);

  return (
    <section>
      <div className="welcome-row">
        <div>
          <p className="eyebrow">YOUR WORKSPACE</p>
          <h1>Good to see you.</h1>
          <p className="page-subtitle">Here’s what’s happening with your business today.</p>
        </div>
        <span className="today-date">{displayDate(today)}</span>
      </div>
      <div className="stat-grid">
        <StatCard label="New inquiries" value={inquiries.filter((row) => text(row, "status") === "new").length} detail="Waiting for a response" tone="blue" error={loadErrors.inquiries} />
        <StatCard label="Clients" value={clients.length} detail="Across your workspace" tone="green" error={loadErrors.clients} />
        <StatCard label="Open tasks" value={tasks.filter((row) => row.done !== true).length} detail="Still on your list" tone="violet" error={loadErrors.tasks} />
        <StatCard label="Due today" value={dueToday.length} detail="Keep the day moving" tone="amber" error={loadErrors.tasks} />
      </div>
      <div className="overview-grid">
        <div className="panel">
          <div className="panel-header">
            <div><h2>Recent inquiries</h2><p>New opportunities for your team</p></div>
            <button className="text-button" onClick={() => onNavigate("inquiries")}>View all <span>→</span></button>
          </div>
          {loadErrors.inquiries ? <InlineError message={loadErrors.inquiries} /> : loading ? <div className="list-placeholder">Loading inquiries…</div> : recentInquiries.length === 0 ? <EmptyList message="No inquiries have arrived yet." /> : (
            <div className="compact-list">
              {recentInquiries.map((row, index) => (
                <div className="compact-row" key={String(row.id ?? index)}>
                  <div className="record-avatar">{(text(row, "name")[0] ?? "?").toUpperCase()}</div>
                  <div className="compact-main"><strong>{text(row, "name") || "Unnamed inquiry"}</strong><span>{text(row, "email") || text(row, "service") || "No details provided"}</span></div>
                  <span className={`status-pill ${text(row, "status") || "unknown"}`}>{text(row, "status") || "Unknown"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="panel">
          <div className="panel-header">
            <div><h2>Tasks due today</h2><p>A little progress goes a long way</p></div>
            <button className="text-button" onClick={() => onNavigate("tasks")}>View all <span>→</span></button>
          </div>
          {loadErrors.tasks ? <InlineError message={loadErrors.tasks} /> : loading ? <div className="list-placeholder">Loading tasks…</div> : dueToday.length === 0 ? <EmptyList message="You're all caught up for today." /> : (
            <div className="compact-list">
              {dueToday.slice(0, 5).map((task, index) => (
                <label className="task-row" key={String(task.id ?? index)}>
                  <input type="checkbox" checked={task.done === true} onChange={() => onToggleTask(task)} aria-label={`Complete ${text(task, "title")}`} />
                  <span>{text(task, "title") || "Untitled task"}</span>
                  {text(task, "priority") === "high" && <span className="priority-mark">High</span>}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="panel clients-panel">
          <div className="panel-header">
            <div><h2>Clients</h2><p>Your growing client list</p></div>
            <button className="text-button" onClick={() => onNavigate("clients")}>View all <span>→</span></button>
          </div>
          {loadErrors.clients ? <InlineError message={loadErrors.clients} /> : loading ? <div className="list-placeholder">Loading clients…</div> : recentClients.length === 0 ? <EmptyList message="Clients added to your CRM will show up here." /> : (
            <div className="compact-list">
              {recentClients.map((row, index) => (
                <div className="compact-row" key={String(row.id ?? index)}>
                  <div className="record-avatar green">{(text(row, "name")[0] ?? "?").toUpperCase()}</div>
                  <div className="compact-main"><strong>{text(row, "name") || "Unnamed client"}</strong><span>{text(row, "company") || text(row, "email") || "No contact details"}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value, detail, tone, error }: { label: string; value: number; detail: string; tone: string; error?: string }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`} aria-hidden="true">{tone === "blue" ? "↗" : tone === "green" ? "◎" : tone === "violet" ? "✓" : "◷"}</div>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{error ? "—" : value}</strong>
      <span className="stat-detail">{error ? "Data unavailable" : detail}</span>
    </div>
  );
}

function RecordTable({
  section,
  data,
  isAdmin,
  onInquiryStatus,
  onToggleTask,
  onClientEdit,
  onCaseUpdate,
}: {
  section: Section;
  data: Row[];
  isAdmin: boolean;
  onInquiryStatus: (row: Row, status: string) => void;
  onToggleTask: (row: Row) => void;
  onClientEdit?: (row: Row) => void;
  onCaseUpdate?: (row: Row, patch: Row) => void;
}) {
  if (section === "tasks") {
    return (
      <div className="record-list">
        {data.map((row, index) => (
          <div className={`record-card${row.done === true ? " completed" : ""}`} key={String(row.id ?? index)}>
            <input type="checkbox" checked={row.done === true} onChange={() => onToggleTask(row)} aria-label={`Complete ${text(row, "title")}`} />
            <div className="record-content">
              <strong>{text(row, "title") || "Untitled task"}</strong>
              <span>{text(row, "due_date") ? `Due ${displayDate(text(row, "due_date"))}` : "No due date"}{text(row, "priority") ? ` · ${text(row, "priority")} priority` : ""}</span>
            </div>
            {row.done === true && <span className="status-pill done">Done</span>}
          </div>
        ))}
      </div>
    );
  }

  const columns: Record<"inquiries" | "clients" | "cases", { key: string; label: string }[]> = {
    inquiries: [
      { key: "name", label: "Contact" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "source", label: "Source" },
      { key: "status", label: "Status" },
      { key: "created_at", label: "Received" },
    ],
    clients: [
      { key: "name", label: "Client" },
      { key: "company", label: "Company" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "created_at", label: "Added" },
    ],
    cases: [
      { key: "subject", label: "Case" },
      { key: "requester_name", label: "Requester" },
      { key: "requester_email", label: "Email" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
      { key: "created_at", label: "Created" },
    ],
  };
  const selectedColumns = columns[section as keyof typeof columns];

  return (
    <div className="table-wrap">
      <table className="records-table">
        <thead><tr>
          {selectedColumns.map((column) => <th key={column.key}>{column.label}</th>)}
          {section === "clients" && onClientEdit && <th>Actions</th>}
          {section === "cases" && onCaseUpdate && <th>Update</th>}
        </tr></thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={String(row.id ?? index)}>
              {selectedColumns.map((column) => (
                <td key={column.key}>
                  {section === "inquiries" && column.key === "status" ? (
                    isAdmin ? (
                      <select className="status-select" value={text(row, "status")} onChange={(event) => onInquiryStatus(row, event.target.value)}>
                        {["new", "contacted", "quoted", "won", "lost"].map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    ) : <span className={`status-pill ${text(row, "status") || "unknown"}`}>{text(row, "status") || "Unknown"}</span>
                  ) : column.key.endsWith("_at") ? (
                    text(row, column.key) ? displayDate(text(row, column.key)) : "—"
                  ) : (
                    text(row, column.key) || "—"
                  )}
                </td>
              ))}
              {section === "clients" && onClientEdit && (
                <td><button className="table-action" onClick={() => onClientEdit(row)}>Edit</button></td>
              )}
              {section === "cases" && onCaseUpdate && (
                <td className="case-actions">
                  <select
                    className="status-select"
                    value={text(row, "status")}
                    aria-label={`Case status for ${text(row, "subject")}`}
                    onChange={(event) => void onCaseUpdate(row, { status: event.target.value })}
                  >
                    {["open", "in_progress", "waiting", "resolved", "closed"].map((status) => (
                      <option key={status} value={status}>{status.replace("_", " ")}</option>
                    ))}
                  </select>
                  <select
                    className="status-select"
                    value={text(row, "priority") || "normal"}
                    aria-label={`Case priority for ${text(row, "subject")}`}
                    onChange={(event) => void onCaseUpdate(row, { priority: event.target.value })}
                  >
                    {["low", "normal", "high", "urgent"].map((priority) => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </select>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModuleRecords({ rows: records, loading, section }: { rows: Row[]; loading: boolean; section: Section }) {
  const hiddenField = /token|secret|password|credential|private.?key|api.?key/i;
  const columns = [...new Set(records.flatMap((record) => Object.keys(record)))]
    .filter((key) => key !== "id" && !key.startsWith("_") && !hiddenField.test(key))
    .filter((key) => records.some((record) => record[key] !== null && record[key] !== undefined && record[key] !== ""))
    .slice(0, 7);

  if (columns.length === 0) {
    return <div className="empty-state"><strong>No displayable fields</strong><span>Records exist, but they do not contain fields this table can show.</span></div>;
  }

  return (
    <div className="table-wrap">
      <table className="records-table">
        <thead><tr>{columns.map((key) => <th key={key}>{labelForColumn(key)}</th>)}</tr></thead>
        <tbody>
          {records.map((record, index) => (
            <tr key={text(record, "id") || index}>
              {columns.map((key) => <td key={key}>{formatCell(record[key])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="module-footnote">
        {sections.find((item) => item.id === section)?.label}: showing up to 200 records
        {loading ? " · Refreshing…" : ""}. Additional editing and workflow actions are still being migrated.
      </div>
    </div>
  );
}

function MessageCenter({
  rows: messages,
  loading,
  onAction,
}: {
  rows: Row[];
  loading: boolean;
  onAction: (row: Row, patch: Row) => Promise<void>;
}) {
  const [filter, setFilter] = useState("inbox");
  const filters = [
    ["inbox", "Inbox"],
    ["unread", "Unread"],
    ["starred", "Starred"],
    ["sent", "Sent"],
    ["spam", "Spam"],
    ["trash", "Trash"],
  ];
  const visible = messages.filter((message) => {
    const folder = text(message, "folder") || "inbox";
    if (filter === "spam" || filter === "trash") return folder === filter;
    if (folder === "spam" || folder === "trash") return false;
    if (filter === "unread") return message.is_read !== true && text(message, "direction") !== "out";
    if (filter === "starred") return message.starred === true;
    if (filter === "sent") return text(message, "direction") === "out";
    return text(message, "direction") !== "out";
  });

  return (
    <section>
      <nav className="module-tabs message-filters" aria-label="Message folders">
        {filters.map(([id, label]) => (
          <button
            className={`module-tab${filter === id ? " selected" : ""}`}
            key={id}
            onClick={() => setFilter(id)}
          >{label}</button>
        ))}
      </nav>
      {visible.length === 0 ? (
        <div className="empty-state">
          <strong>{loading ? "Loading messages…" : `No ${filter} messages`}</strong>
          {!loading && <span>Messages in this folder will appear here when available.</span>}
        </div>
      ) : (
        <div className="message-list">
          {visible.map((message, index) => {
            const folder = text(message, "folder") || "inbox";
            const outgoing = text(message, "direction") === "out";
            const sender = outgoing
              ? `To ${text(message, "to_address") || "recipient"}`
              : text(message, "from_name") || text(message, "from_address") || "Unknown sender";
            return (
              <article className={`message-card${message.is_read === true ? "" : " unread"}`} key={text(message, "id") || index}>
                <button
                  className={`message-star${message.starred === true ? " starred" : ""}`}
                  aria-label={message.starred === true ? "Remove star" : "Star message"}
                  title={message.starred === true ? "Remove star" : "Star message"}
                  onClick={() => void onAction(message, { starred: message.starred !== true })}
                >★</button>
                <div className="message-main">
                  <div className="message-meta">
                    <strong>{sender}</strong>
                    <span>{text(message, "received_at") ? displayDate(text(message, "received_at")) : ""}</span>
                  </div>
                  <strong className="message-subject">{text(message, "subject") || "(No subject)"}</strong>
                  <p>{text(message, "body") || "No message preview available."}</p>
                </div>
                <div className="message-actions">
                  {!outgoing && (
                    <button className="table-action" onClick={() => void onAction(message, { is_read: message.is_read !== true })}>
                      {message.is_read === true ? "Mark unread" : "Mark read"}
                    </button>
                  )}
                  <select
                    className="status-select"
                    aria-label="Move message"
                    value={folder}
                    onChange={(event) => void onAction(message, { folder: event.target.value })}
                  >
                    <option value="inbox">Inbox</option>
                    <option value="spam">Spam</option>
                    <option value="trash">Trash</option>
                  </select>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

const supportedApprovals = new Set([
  "inq_status",
  "inq_touch",
  "inq_edit",
  "inq_delete",
  "task_add",
  "task_delete",
]);

function ApprovalsList({
  rows: approvals,
  isAdmin,
  onDecision,
}: {
  rows: Row[];
  isAdmin: boolean;
  onDecision: (row: Row, approve: boolean) => Promise<void>;
}) {
  const [filter, setFilter] = useState("pending");
  const [busyId, setBusyId] = useState("");
  const visible = approvals.filter((approval) =>
    filter === "all" || (filter === "pending" ? text(approval, "status") === "pending" : text(approval, "status") !== "pending"),
  );

  async function decide(row: Row, approve: boolean) {
    const id = text(row, "id");
    if (!id || busyId) return;
    setBusyId(id);
    try {
      await onDecision(row, approve);
    } finally {
      setBusyId("");
    }
  }

  return (
    <section>
      <nav className="module-tabs" aria-label="Approval status">
        {[
          ["pending", "Pending"],
          ["decided", "Recent decisions"],
          ["all", "All"],
        ].map(([id, label]) => (
          <button className={`module-tab${filter === id ? " selected" : ""}`} key={id} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </nav>
      {visible.length === 0 ? (
        <div className="empty-state"><strong>No {filter === "pending" ? "pending requests" : "requests"}.</strong></div>
      ) : (
        <div className="approval-list">
          {visible.map((approval, index) => {
            const pending = text(approval, "status") === "pending";
            const action = text(approval, "action");
            const canApprove = supportedApprovals.has(action);
            const status = text(approval, "status");
            return (
              <article className="approval-card" key={text(approval, "id") || index}>
                <div className="approval-copy">
                  <div className="approval-title">
                    <strong>{text(approval, "summary") || "Approval request"}</strong>
                    <span className={`status-pill ${pending ? "contacted" : status === "approved" ? "won" : "lost"}`}>
                      {pending ? "Pending" : status === "rejected" ? "Declined" : status}
                    </span>
                  </div>
                  <span>From {text(approval, "requested_by") || "team member"} · {text(approval, "action")}</span>
                  {text(approval, "note") && <span>Note: {text(approval, "note")}</span>}
                  {pending && isAdmin && !canApprove && (
                    <span className="approval-warning">This action is not supported yet; it cannot be approved here.</span>
                  )}
                </div>
                {pending && isAdmin && (
                  <div className="approval-actions">
                    <button
                      className="primary-button"
                      disabled={busyId === text(approval, "id") || !canApprove}
                      onClick={() => void decide(approval, true)}
                    >Approve</button>
                    <button
                      className="secondary-button"
                      disabled={busyId === text(approval, "id")}
                      onClick={() => void decide(approval, false)}
                    >Decline</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ClientEditor({
  client,
  onClose,
  onSubmit,
}: {
  client: Row | null;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="editor-dialog" role="dialog" aria-modal="true" aria-labelledby="client-editor-title">
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">CLIENTS</p>
            <h2 id="client-editor-title">{client ? "Edit client" : "New client"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close client form">×</button>
        </div>
        <form action={onSubmit} className="client-form">
          <label>Name<input name="name" required maxLength={160} defaultValue={text(client ?? {}, "name")} /></label>
          <label>Company<input name="company" maxLength={200} defaultValue={text(client ?? {}, "company")} /></label>
          <label>Email<input name="email" type="email" maxLength={254} defaultValue={text(client ?? {}, "email")} /></label>
          <label>Phone<input name="phone" type="tel" maxLength={50} defaultValue={text(client ?? {}, "phone")} /></label>
          <label>Notes<textarea name="notes" rows={4} maxLength={4000} defaultValue={text(client ?? {}, "notes")} /></label>
          <div className="dialog-actions">
            <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
            <button className="primary-button" type="submit">{client ? "Save client" : "Add client"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function labelForColumn(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") {
    const isoDate = /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value);
    if (isoDate) return displayDate(value);
    return value.length > 160 ? `${value.slice(0, 157)}…` : value;
  }
  if (typeof value === "number") return new Intl.NumberFormat().format(value);
  if (Array.isArray(value)) return value.map((item) => formatCell(item)).join(", ");
  return "[Details]";
}

function TaskForm({ onSubmit }: { onSubmit: (formData: FormData) => void }) {
  return (
    <details className="task-form">
      <summary className="primary-button">+ New task</summary>
      <form action={onSubmit} className="task-form-popover">
        <label>Task title<input name="title" required maxLength={180} placeholder="What needs to get done?" /></label>
        <label>Due date<input name="due_date" type="date" /></label>
        <label>Priority<select name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
        <button className="primary-button" type="submit">Create task</button>
      </form>
    </details>
  );
}

function ChatComposer({ onSubmit }: { onSubmit: (formData: FormData) => void }) {
  return (
    <form action={onSubmit} className="chat-composer">
      <input name="body" required maxLength={4000} placeholder="Message the team…" aria-label="Team message" />
      <button className="primary-button" type="submit">Send</button>
    </form>
  );
}

function InlineError({ message }: { message: string }) {
  return <div className="inline-error">Could not load this data: {message}</div>;
}

function EmptyList({ message }: { message: string }) {
  return <div className="list-placeholder">{message}</div>;
}
