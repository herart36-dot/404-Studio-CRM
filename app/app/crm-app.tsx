"use client";

import { type SupabaseClient, type User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import DealsBoard from "./deals-board";
import { AIPanel } from "./ai-panel";
import { SecurityQuestionGate } from "./security-question";
import { Overview, RecordTable, ModuleRecords, MessageCenter, ApprovalsList, ClientEditor, TaskForm, ChatComposer } from "./sections";
import { getSupabase } from "@/lib/supabase";
import {
  type Row, type Section, type CRMData, type LoadErrors, type AccessState,
  sections, emptyData, sectionTables, isRow, isCoreSection, rows, text, errorMessage,
} from "@/lib/crm-utils";

export default function CRMApp() {
  const router = useRouter();
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
    const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setError("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to connect this CRM to Supabase.");
      setLoading(false);
      return;
    }
    setClient(supabase);
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        router.replace("/login");
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
      if (!sessionData.session) router.replace("/login");
      setLoading(false);
    });

    return () => auth.subscription.unsubscribe();
  }, [router]);

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

  async function signOut() {
    if (!client) return;
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) setError(signOutError.message);
    else router.push("/");
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
  if (!user) return <div className="loading-screen">Taking you to the login…</div>;

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
        <Link className="brand" href="/" aria-label="Hellobase home">
          <span className="brand-mark small">h<span>.</span></span>
          <span className="brand-name">hellobase</span>
        </Link>
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
          <a className="text-button" href="/legacy/index.html#crm" title="Gmail, calendar and other features not yet moved">Classic</a>
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
            <div className="account-menu">
              <button className="avatar-button" title={user.email ?? "Account"} aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
                {(user.email?.[0] ?? "U").toUpperCase()}
              </button>
              {menuOpen && (
                <div className="account-dropdown" role="menu">
                  <span className="account-email">{user.email}</span>
                  <button role="menuitem" onClick={() => { setMenuOpen(false); setActiveSection("settings"); setActiveTable(sectionTables.settings?.[0]?.table ?? ""); }}>Settings</button>
                  <button role="menuitem" onClick={() => void signOut()}>Sign out</button>
                </div>
              )}
            </div>
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
          ) : activeSection === "deals" && client && user ? (
            <DealsBoard
              client={client}
              user={user}
              isAdmin={isAdmin}
              onNotice={(message) => { setError(""); setNotice(message); }}
              onError={(message) => { setNotice(""); setError(message); }}
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
      {client && role !== "executive" && (
        <AIPanel client={client} user={user} isAdmin={isAdmin} onChanged={() => void safelyLoadCRM(client)} />
      )}
      {client && <SecurityQuestionGate client={client} />}
    </main>
  );
}

