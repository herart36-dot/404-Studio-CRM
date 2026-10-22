"use client";

import { useEffect, useState } from "react";
import { type Row, type Section, type CRMData, type LoadErrors, sections, text, displayDate, isRow } from "@/lib/crm-utils";

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatWait(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d`;
}

export function Overview({
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
  const nowMs = useNow();
  const waiting = inquiries
    .filter((row) => text(row, "status") === "new")
    .map((row) => ({ row, ms: nowMs - new Date(text(row, "created_at")).getTime() }))
    .filter((item) => Number.isFinite(item.ms))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 5);
  const cold = inquiries
    .filter((row) => !["new", "won", "lost"].includes(text(row, "status")))
    .map((row) => ({ row, ms: nowMs - new Date(text(row, "last_touch") || text(row, "created_at")).getTime() }))
    .filter((item) => Number.isFinite(item.ms) && item.ms >= 48 * 3600000)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 5);
  const overdue = tasks
    .filter((task) => task.done !== true && text(task, "due_date") && text(task, "due_date").slice(0, 10) < today)
    .slice(0, 5);
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
      <div className="overview-grid attention-grid">
        <div className="panel">
          <div className="panel-header"><div><h2>Waiting longest</h2><p>New inquiries nobody has answered</p></div></div>
          {waiting.length === 0 ? <EmptyList message="Nobody is waiting. Nice." /> : (
            <div className="compact-list">
              {waiting.map(({ row, ms }, index) => (
                <div className="compact-row" key={String(row.id ?? index)}>
                  <div className="record-avatar">{(text(row, "name")[0] ?? "?").toUpperCase()}</div>
                  <div className="compact-main"><strong>{text(row, "name") || "Unnamed inquiry"}</strong><span>{text(row, "service") || text(row, "email") || "No details"}</span></div>
                  <span className="status-pill new">{formatWait(ms)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="panel">
          <div className="panel-header"><div><h2>Going cold</h2><p>No contact for 2+ days</p></div></div>
          {cold.length === 0 ? <EmptyList message="Nothing is going cold." /> : (
            <div className="compact-list">
              {cold.map(({ row, ms }, index) => (
                <div className="compact-row" key={String(row.id ?? index)}>
                  <div className="record-avatar">{(text(row, "name")[0] ?? "?").toUpperCase()}</div>
                  <div className="compact-main"><strong>{text(row, "name") || "Unnamed inquiry"}</strong><span>{text(row, "status")}</span></div>
                  <span className="status-pill lost">{formatWait(ms)} quiet</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="panel">
          <div className="panel-header"><div><h2>Overdue tasks</h2><p>Past their due date</p></div></div>
          {overdue.length === 0 ? <EmptyList message="No overdue tasks." /> : (
            <div className="compact-list">
              {overdue.map((task, index) => (
                <label className="task-row" key={String(task.id ?? index)}>
                  <input type="checkbox" checked={task.done === true} onChange={() => onToggleTask(task)} aria-label={`Complete ${text(task, "title")}`} />
                  <span>{text(task, "title") || "Untitled task"}</span>
                  <span className="priority-mark">{displayDate(text(task, "due_date"))}</span>
                </label>
              ))}
            </div>
          )}
        </div>
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

export function StatCard({ label, value, detail, tone, error }: { label: string; value: number; detail: string; tone: string; error?: string }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`} aria-hidden="true">{tone === "blue" ? "↗" : tone === "green" ? "◎" : tone === "violet" ? "✓" : "◷"}</div>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{error ? "—" : value}</strong>
      <span className="stat-detail">{error ? "Data unavailable" : detail}</span>
    </div>
  );
}

export function RecordTable({
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

export function ModuleRecords({ rows: records, loading, section }: { rows: Row[]; loading: boolean; section: Section }) {
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

export function MessageCenter({
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

export function ApprovalsList({
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

export function ClientEditor({
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

export function labelForColumn(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatCell(value: unknown): string {
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

export function TaskForm({ onSubmit }: { onSubmit: (formData: FormData) => void }) {
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

export function ChatComposer({ onSubmit }: { onSubmit: (formData: FormData) => void }) {
  return (
    <form action={onSubmit} className="chat-composer">
      <input name="body" required maxLength={4000} placeholder="Message the team…" aria-label="Team message" />
      <button className="primary-button" type="submit">Send</button>
    </form>
  );
}

export function InlineError({ message }: { message: string }) {
  return <div className="inline-error">Could not load this data: {message}</div>;
}

export function EmptyList({ message }: { message: string }) {
  return <div className="list-placeholder">{message}</div>;
}

