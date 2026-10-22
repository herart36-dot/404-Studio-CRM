"use client";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { useRef, useState } from "react";
import "./ai-panel.css";

type Action = Record<string, unknown> & { type?: string };
type Msg = { role: "user" | "model"; text: string; actions?: Action[] };

const STATUSES = ["new", "contacted", "quoted", "won", "lost"];
const PRIORITIES = ["low", "normal", "high"];
const MAX_TURNS = 10;

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v);
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isId = (v: string) => /^[0-9a-zA-Z-]{8,64}$/.test(v);

/** Every action the model proposes is checked here before anything can run. */
function validate(action: Action): { ok: true; title: string; lines: string[] } | { ok: false; reason: string } {
  switch (action.type) {
    case "create_task": {
      const title = str(action.title, 200);
      if (!title) return { ok: false, reason: "The task has no title." };
      const due = str(action.due_date, 10);
      if (due && !isDate(due)) return { ok: false, reason: "The due date is not valid." };
      const priority = str(action.priority, 10) || "normal";
      if (!PRIORITIES.includes(priority)) return { ok: false, reason: "The priority is not valid." };
      return { ok: true, title: "Add task", lines: [title, due ? `Due ${due}` : "No due date", `${priority} priority`] };
    }
    case "create_client": {
      const name = str(action.name, 120);
      const email = str(action.email, 200);
      if (!name) return { ok: false, reason: "The client has no name." };
      if (email && !isEmail(email)) return { ok: false, reason: "The email address is not valid." };
      return { ok: true, title: "Add client", lines: [name, email, str(action.company, 120)].filter(Boolean) };
    }
    case "update_inquiry": {
      const id = str(action.id, 64);
      const status = str(action.status, 20);
      if (!isId(id)) return { ok: false, reason: "The inquiry could not be identified." };
      if (!STATUSES.includes(status)) return { ok: false, reason: "The status is not valid." };
      return { ok: true, title: "Update inquiry", lines: [str(action.label, 120) || "Inquiry", `New status: ${status}`] };
    }
    default:
      return { ok: false, reason: "This kind of action is not available in the new CRM yet." };
  }
}

export function AIPanel({ client, user, isAdmin, onChanged }: { client: SupabaseClient; user: User; isAdmin: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  async function ask(textValue: string) {
    const content = textValue.trim();
    if (!content || busy) return;
    setError("");
    const next: Msg[] = [...msgs, { role: "user", text: content }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    const { data, error: fnError } = await client.functions.invoke("crm-ai", {
      body: {
        messages: next.slice(-MAX_TURNS).map(({ role, text }) => ({ role, text })),
        today: new Date().toISOString().slice(0, 10),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      },
    });
    setBusy(false);
    if (fnError || !data || typeof data.reply !== "string") {
      setError("The assistant could not answer. Try again in a minute.");
      return;
    }
    const actions = Array.isArray(data.actions) ? (data.actions as Action[]).slice(0, 3) : [];
    setMsgs([...next, { role: "model", text: data.reply, actions }]);
    setTimeout(() => bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight }), 50);
  }

  async function run(action: Action): Promise<string> {
    const email = user.email?.toLowerCase() ?? "";
    let message = "";
    if (action.type === "create_task") {
      const values = {
        title: str(action.title, 200),
        due_date: str(action.due_date, 10) || null,
        priority: str(action.priority, 10) || "normal",
        client_id: null,
      };
      if (isAdmin) {
        const { error: e } = await client.from("crm_tasks").insert({ ...values, done: false });
        if (e) throw new Error(e.message);
        message = "Task added.";
      } else {
        const { error: e } = await client.from("crm_approvals").insert({
          requested_by: email, action: "task_add", target_id: null,
          summary: `Add the task "${values.title}"`.slice(0, 600), payload: { values, assigned: "" },
        });
        if (e) throw new Error(e.message);
        message = "Sent to an administrator for approval. Nothing changes until they approve.";
      }
    } else if (action.type === "create_client") {
      const { error: e } = await client.from("crm_clients").insert({
        name: str(action.name, 120), email: str(action.email, 200) || null,
        phone: str(action.phone, 60) || null, company: str(action.company, 120) || null, notes: str(action.notes, 1000) || null,
      });
      if (e) throw new Error(e.message);
      message = "Client added.";
    } else if (action.type === "update_inquiry") {
      const id = str(action.id, 64);
      const status = str(action.status, 20);
      if (isAdmin) {
        const now = new Date().toISOString();
        const { error: e } = await client.from("crm_inquiries").update({ status, last_touch: now }).eq("id", id);
        if (e) throw new Error(e.message);
        message = "Inquiry updated.";
      } else {
        const { error: e } = await client.from("crm_approvals").insert({
          requested_by: email, action: "inq_status", target_id: id,
          summary: `AI: change ${str(action.label, 120) || "inquiry"} to ${status}`.slice(0, 600), payload: { status },
        });
        if (e) throw new Error(e.message);
        message = "Sent to an administrator for approval. Nothing changes until they approve.";
      }
    }
    try { await client.from("crm_ai_activity").insert({ user_id: user.id, kind: String(action.type), summary: message.slice(0, 500) }); } catch { /* optional log */ }
    onChanged();
    return message;
  }

  return (
    <>
      <button className="ai-fab" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Open the assistant">
        {open ? "×" : "✦"}
      </button>
      {open && (
        <section className="ai-panel" aria-label="Assistant">
          <header><strong>Hello, your assistant</strong><span>You confirm every change.</span></header>
          <div className="ai-body" ref={bodyRef}>
            {msgs.length === 0 && (
              <div className="ai-empty">
                <p>Ask in plain words:</p>
                {["Add a task for tomorrow: call Cafe Luna", "Add a client: Anna Cruz, anna@example.com", "Who should I follow up first?"].map((q) => (
                  <button key={q} onClick={() => void ask(q)}>{q}</button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role === "user" ? "me" : "bot"}`}>
                <p>{m.text}</p>
                {m.actions?.map((a, j) => <ActionCard key={j} action={a} onRun={run} />)}
              </div>
            ))}
            {busy && <div className="ai-msg bot"><p>Thinking…</p></div>}
            {error && <div className="ai-error" role="alert">{error}</div>}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void ask(input); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Tell Hello what you need…" maxLength={1000} aria-label="Message" />
            <button disabled={busy || !input.trim()}>Send</button>
          </form>
        </section>
      )}
    </>
  );
}

function ActionCard({ action, onRun }: { action: Action; onRun: (a: Action) => Promise<string> }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "cancelled">("idle");
  const [result, setResult] = useState("");
  const check = validate(action);
  if (!check.ok) return <div className="ai-card muted">{check.reason}</div>;
  if (state === "cancelled") return <div className="ai-card muted">Cancelled.</div>;
  if (state === "done") return <div className="ai-card done">✓ {result}</div>;
  return (
    <div className="ai-card">
      <b>{check.title}</b>
      {check.lines.map((l, i) => <span key={i}>{l}</span>)}
      {result && <span className="err">{result}</span>}
      <div>
        <button disabled={state === "working"} onClick={async () => {
          setState("working"); setResult("");
          try { setResult(await onRun(action)); setState("done"); }
          catch (e) { setResult(e instanceof Error ? e.message : "Something went wrong. Nothing was changed."); setState("idle"); }
        }}>{state === "working" ? "Working…" : "Confirm"}</button>
        <button className="ghost" disabled={state === "working"} onClick={() => setState("cancelled")}>Cancel</button>
      </div>
    </div>
  );
}
