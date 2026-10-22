"use client";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./deals.css";

type Row = Record<string, unknown>;
type StageKind = "open" | "won" | "lost";
type Stage = { id: string; name: string; position: number; probability: number; kind: StageKind };
type Deal = {
  id: string;
  title: string;
  stage_id: string;
  value: number;
  probability: number;
  owner_email: string;
  expected_close: string;
  client_id: string;
  account_id: string;
  notes: string;
  win_loss_reason: string;
  win_loss_note: string;
  closed_at: string;
};
type Option = { id: string; name: string };

// Win/loss reasons used by the legacy CRM.
const WIN_REASONS = ["Price", "Relationship", "Product fit", "Timing", "Referral", "Service quality"];
const LOSS_REASONS = ["Price too high", "Chose a competitor", "No budget", "No response", "Bad timing", "Not a fit"];

const peso = (n: number) => "₱" + Math.round(n).toLocaleString("en-PH");
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const today = () => new Date().toISOString().slice(0, 10);

function toStage(r: Row): Stage {
  const kind = str(r.kind);
  return {
    id: str(r.id),
    name: str(r.name),
    position: num(r.position),
    probability: num(r.probability),
    kind: kind === "won" || kind === "lost" ? kind : "open",
  };
}

function toDeal(r: Row): Deal {
  return {
    id: str(r.id),
    title: str(r.title),
    stage_id: str(r.stage_id),
    value: num(r.value),
    probability: num(r.probability),
    owner_email: str(r.owner_email),
    expected_close: str(r.expected_close),
    client_id: str(r.client_id),
    account_id: str(r.account_id),
    notes: str(r.notes),
    win_loss_reason: str(r.win_loss_reason),
    win_loss_note: str(r.win_loss_note),
    closed_at: str(r.closed_at),
  };
}

function fmtDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(d);
}

type Pending =
  | { type: "form"; deal: Deal | null }
  | { type: "close"; deal: Deal; stage: Stage }
  | { type: "stages" }
  | null;

export default function DealsBoard({
  client,
  user,
  isAdmin,
  onNotice,
  onError,
}: {
  client: SupabaseClient;
  user: User;
  isAdmin: boolean;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [contacts, setContacts] = useState<Option[]>([]);
  const [members, setMembers] = useState<{ email: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<"board" | "list">("board");
  const [pending, setPending] = useState<Pending>(null);
  const [overStage, setOverStage] = useState("");
  const [filters, setFilters] = useState({ q: "", owner: "", stage: "", from: "", to: "" });

  const load = useCallback(async () => {
    const [s, d, a, c, m] = await Promise.all([
      client.from("crm_deal_stages").select("*").order("position"),
      client.from("crm_deals").select("*").order("created_at", { ascending: false }),
      client.from("crm_accounts").select("id,name").order("name"),
      client.from("crm_clients").select("id,name").order("name"),
      client.from("crm_staff").select("email,name"),
    ]);
    if (s.error || d.error) {
      setLoadError((s.error ?? d.error)?.message ?? "Could not load deals.");
      setLoading(false);
      return;
    }
    setLoadError("");
    setStages(((s.data ?? []) as Row[]).map(toStage));
    setDeals(((d.data ?? []) as Row[]).map(toDeal));
    setAccounts(((a.data ?? []) as Row[]).map((r) => ({ id: str(r.id), name: str(r.name) })));
    setContacts(((c.data ?? []) as Row[]).map((r) => ({ id: str(r.id), name: str(r.name) })));
    setMembers(((m.data ?? []) as Row[]).map((r) => ({ email: str(r.email).toLowerCase(), name: str(r.name) })));
    setLoading(false);
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const accountName = useCallback((id: string) => accounts.find((a) => a.id === id)?.name ?? "", [accounts]);
  const contactName = useCallback((id: string) => contacts.find((c) => c.id === id)?.name ?? "", [contacts]);
  const ownerName = (email: string) =>
    members.find((m) => m.email === email.toLowerCase())?.name || email || "Unassigned";
  const kindOf = (d: Deal): StageKind => stageById.get(d.stage_id)?.kind ?? "open";
  const probOf = (d: Deal) => (kindOf(d) === "won" ? 100 : kindOf(d) === "lost" ? 0 : d.probability);
  const weighted = (d: Deal) => (d.value * probOf(d)) / 100;
  const sum = (list: Deal[], f: (d: Deal) => number) => list.reduce((t, d) => t + f(d), 0);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return deals.filter(
      (d) =>
        (!filters.owner ||
          (filters.owner === "-" ? !d.owner_email : d.owner_email.toLowerCase() === filters.owner)) &&
        (!filters.stage || d.stage_id === filters.stage) &&
        (!filters.from || (d.expected_close && d.expected_close >= filters.from)) &&
        (!filters.to || (d.expected_close && d.expected_close <= filters.to)) &&
        (!q || [d.title, contactName(d.client_id), accountName(d.account_id)].some((x) => x.toLowerCase().includes(q))),
    );
  }, [deals, filters, contactName, accountName]);

  const filtering = Boolean(filters.q || filters.owner || filters.stage || filters.from || filters.to);
  const open = filtered.filter((d) => kindOf(d) === "open");
  const won = filtered.filter((d) => kindOf(d) === "won");
  const lost = filtered.filter((d) => kindOf(d) === "lost");
  const winRate = won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) + "%" : "—";

  async function run(promise: PromiseLike<{ error: { message: string } | null }>, ok: string) {
    onError("");
    const { error } = await promise;
    if (error) {
      onError(error.message || "Could not save. Check your access or try again.");
      return false;
    }
    await load();
    onNotice(ok);
    return true;
  }

  function moveDeal(deal: Deal, stageId: string) {
    const stage = stageById.get(stageId);
    if (!stage || deal.stage_id === stageId) return;
    if (stage.kind === "open") {
      void run(
        client
          .from("crm_deals")
          .update({ stage_id: stageId, probability: stage.probability, closed_at: null, win_loss_reason: null, win_loss_note: null })
          .eq("id", deal.id),
        `Moved to ${stage.name}.`,
      );
    } else {
      setPending({ type: "close", deal, stage });
    }
  }

  async function deleteDeal(deal: Deal) {
    if (!window.confirm(`Delete the deal “${deal.title}”? This cannot be undone.`)) return;
    onError("");
    const { data, error } = await client.from("crm_deals").delete().eq("id", deal.id).select();
    if (error) return onError(error.message);
    if (!data?.length) return onError("Only the admin or the deal owner can delete this deal.");
    await load();
    onNotice("Deal deleted.");
  }

  async function saveDeal(existing: Deal | null, form: FormData) {
    const stage = stageById.get(str(form.get("stage_id")));
    if (!stage) return onError("Pick a stage.");
    const value = num(form.get("value"));
    const probRaw = str(form.get("probability"));
    const probability = probRaw === "" ? stage.probability : num(probRaw);
    if (value < 0 || probability < 0 || probability > 100) {
      return onError("Value must be 0 or more and probability between 0 and 100.");
    }
    const reason = str(form.get("win_loss_reason"));
    const isOpen = stage.kind === "open";
    if (!isOpen && !reason) return onError(`Pick a reason for this ${stage.kind === "won" ? "win" : "loss"}.`);
    const payload = {
      title: str(form.get("title")).trim(),
      stage_id: stage.id,
      value,
      probability: stage.kind === "won" ? 100 : stage.kind === "lost" ? 0 : probability,
      owner_email: str(form.get("owner_email")) || null,
      expected_close: str(form.get("expected_close")) || null,
      client_id: str(form.get("client_id")) || null,
      account_id: str(form.get("account_id")) || null,
      notes: str(form.get("notes")) || null,
      win_loss_reason: isOpen ? null : reason,
      win_loss_note: isOpen ? null : str(form.get("win_loss_note")) || null,
      closed_at: isOpen
        ? null
        : existing?.closed_at && stageById.get(existing.stage_id)?.kind === stage.kind
          ? existing.closed_at
          : new Date().toISOString(),
    };
    const ok = await run(
      existing ? client.from("crm_deals").update(payload).eq("id", existing.id) : client.from("crm_deals").insert(payload),
      existing ? "Deal saved." : "Deal added.",
    );
    if (ok) setPending(null);
  }

  async function confirmClose(deal: Deal, stage: Stage, form: FormData) {
    const reason = str(form.get("win_loss_reason"));
    if (!reason) return onError("Pick a reason.");
    const ok = await run(
      client
        .from("crm_deals")
        .update({
          stage_id: stage.id,
          probability: stage.kind === "won" ? 100 : 0,
          closed_at: new Date().toISOString(),
          win_loss_reason: reason,
          win_loss_note: str(form.get("win_loss_note")) || null,
        })
        .eq("id", deal.id),
      `Moved to ${stage.name}.`,
    );
    if (ok) setPending(null);
  }

  const firstOpen = stages.find((s) => s.kind === "open") ?? stages[0];

  if (loading) return <div className="empty-state">Loading deals…</div>;
  if (loadError) {
    return (
      <div className="empty-state">
        <strong>Deals are not set up yet</strong>
        <span>{loadError} Ask the admin to run the deals setup SQL in Supabase, then reload.</span>
      </div>
    );
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORK</p>
          <h1>Deals</h1>
          <p className="page-subtitle">
            {filtered.length} {filtered.length === 1 ? "deal" : "deals"}
          </p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" onClick={() => void load().then(() => onNotice("Updated."))}>
            Refresh
          </button>
          {isAdmin && (
            <button className="secondary-button" onClick={() => setPending({ type: "stages" })}>
              Customize stages
            </button>
          )}
          {stages.length > 0 && (
            <button className="primary-button" onClick={() => setPending({ type: "form", deal: null })}>
              + New deal
            </button>
          )}
        </div>
      </div>

      {stages.length === 0 ? (
        <div className="empty-state">
          <strong>No stages yet</strong>
          <span>Add the stages of your sales process to start tracking deals.</span>
        </div>
      ) : (
        <>
          <div className="deal-kpis">
            <Kpi label="Open deals" value={String(open.length)} />
            <Kpi label="Pipeline value" value={peso(sum(open, (d) => d.value))} />
            <Kpi label="Weighted forecast" value={peso(sum(open, weighted))} detail="Value × probability" />
            <Kpi label="Won" value={String(won.length)} detail={peso(sum(won, (d) => d.value))} />
            <Kpi label="Win rate" value={winRate} detail={`${won.length} won · ${lost.length} lost`} />
          </div>

          <div className="deal-bar">
            <input
              className="search-input"
              type="search"
              placeholder="Search deals, contacts, companies"
              aria-label="Search deals"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
            <select className="status-select" aria-label="Owner" value={filters.owner} onChange={(e) => setFilters({ ...filters, owner: e.target.value })}>
              <option value="">All owners</option>
              {members.map((m) => (
                <option key={m.email} value={m.email}>{m.name || m.email}</option>
              ))}
              <option value="-">Unassigned</option>
            </select>
            <select className="status-select" aria-label="Stage" value={filters.stage} onChange={(e) => setFilters({ ...filters, stage: e.target.value })}>
              <option value="">All stages</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <label className="deal-date">
              Close from
              <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
            </label>
            <label className="deal-date">
              to
              <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
            </label>
            {filtering && (
              <button className="text-button" onClick={() => setFilters({ q: "", owner: "", stage: "", from: "", to: "" })}>
                Clear filters
              </button>
            )}
            <span className="deal-spacer" />
            <div className="deal-toggle" role="group" aria-label="View">
              {(["board", "list"] as const).map((m) => (
                <button key={m} className={mode === m ? "selected" : ""} aria-pressed={mode === m} onClick={() => setMode(m)}>
                  {m === "board" ? "Board" : "List"}
                </button>
              ))}
            </div>
          </div>

          {deals.length === 0 ? (
            <div className="empty-state">
              <strong>No deals yet</strong>
              <span>Add your first deal and link it to a contact and company.</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <strong>No deals match these filters</strong>
              <span>Try a different owner, stage or date range.</span>
            </div>
          ) : mode === "board" ? (
            <div className="deal-board">
              {stages.map((s) => {
                const col = filtered
                  .filter((d) => d.stage_id === s.id)
                  .sort((a, b) => (a.expected_close || "9999").localeCompare(b.expected_close || "9999"));
                return (
                  <div
                    key={s.id}
                    className={`deal-col${overStage === s.id ? " over" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setOverStage(s.id); }}
                    onDragLeave={() => setOverStage("")}
                    onDrop={(e) => {
                      e.preventDefault();
                      setOverStage("");
                      const deal = deals.find((d) => d.id === e.dataTransfer.getData("text/plain"));
                      if (deal) moveDeal(deal, s.id);
                    }}
                  >
                    <div className="deal-col-head">
                      <b>{s.name}</b>
                      <span>{col.length} · {peso(sum(col, (d) => d.value))}</span>
                      {s.kind === "open" && <span>Weighted {peso(sum(col, weighted))}</span>}
                    </div>
                    {col.length === 0 && <div className="deal-drop">Drop a deal here</div>}
                    {col.map((d) => {
                      const overdue = s.kind === "open" && d.expected_close !== "" && d.expected_close < today();
                      return (
                        <article
                          key={d.id}
                          className="deal-card"
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("text/plain", d.id)}
                          onClick={() => setPending({ type: "form", deal: d })}
                        >
                          <b>{d.title}</b>
                          <div>{[accountName(d.account_id), contactName(d.client_id)].filter(Boolean).join(" · ") || "No contact or company"}</div>
                          <div>{peso(d.value)} · {probOf(d)}%</div>
                          <div className={overdue ? "deal-overdue" : undefined}>
                            {d.expected_close ? `${overdue ? "Overdue · " : "Close "}${fmtDate(d.expected_close)} · ` : ""}
                            {ownerName(d.owner_email)}
                          </div>
                          {s.kind !== "open" && d.win_loss_reason && (
                            <div>{s.kind === "won" ? "Won: " : "Lost: "}{d.win_loss_reason}</div>
                          )}
                          <div className="deal-card-actions" onClick={(e) => e.stopPropagation()}>
                            <button className="table-action danger" onClick={() => void deleteDeal(d)}>Delete</button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="records-table">
                <thead>
                  <tr>
                    {["Deal", "Contact", "Company", "Stage", "Value", "Prob.", "Weighted", "Expected close", "Owner", ""].map((t) => (
                      <th key={t}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...filtered]
                    .sort((a, b) => (a.expected_close || "9999").localeCompare(b.expected_close || "9999"))
                    .map((d) => (
                      <tr key={d.id} className="deal-row" onClick={() => setPending({ type: "form", deal: d })}>
                        <td><b>{d.title}</b></td>
                        <td>{contactName(d.client_id) || "—"}</td>
                        <td>{accountName(d.account_id) || "—"}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <select
                            className="status-select"
                            aria-label="Stage"
                            value={d.stage_id}
                            onChange={(e) => moveDeal(d, e.target.value)}
                          >
                            {stages.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </td>
                        <td>{peso(d.value)}</td>
                        <td>{probOf(d)}%</td>
                        <td>{peso(weighted(d))}</td>
                        <td>{d.expected_close ? fmtDate(d.expected_close) : "—"}</td>
                        <td>{ownerName(d.owner_email)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button className="table-action danger" onClick={() => void deleteDeal(d)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}><b>Total · {filtered.length} deals</b></td>
                    <td><b>{peso(sum(filtered, (d) => d.value))}</b></td>
                    <td />
                    <td><b>{peso(sum(filtered, weighted))}</b></td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {pending?.type === "form" && (
        <Dialog title={pending.deal ? "Edit deal" : "New deal"} onClose={() => setPending(null)}>
          <form className="client-form" action={(fd) => void saveDeal(pending.deal, fd)}>
            <label>Deal name<input name="title" required maxLength={200} defaultValue={pending.deal?.title ?? ""} /></label>
            <label>
              Contact
              <select name="client_id" defaultValue={pending.deal?.client_id ?? ""}>
                <option value="">No contact</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>
              Company
              <select name="account_id" defaultValue={pending.deal?.account_id ?? ""}>
                <option value="">No company</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label>Deal value (₱)<input name="value" type="number" min={0} step="any" defaultValue={pending.deal?.value ?? ""} placeholder="0" /></label>
            <label>
              Stage
              <select name="stage_id" defaultValue={pending.deal?.stage_id ?? firstOpen?.id}>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label>Probability (%)<input name="probability" type="number" min={0} max={100} defaultValue={pending.deal?.probability ?? ""} placeholder="Defaults to the stage" /></label>
            <label>Expected close date<input name="expected_close" type="date" defaultValue={pending.deal?.expected_close ?? ""} /></label>
            <label>
              Owner
              <select name="owner_email" defaultValue={pending.deal?.owner_email ?? user.email ?? ""}>
                <option value="">Unassigned</option>
                {members.map((m) => <option key={m.email} value={m.email}>{m.name || m.email}</option>)}
              </select>
            </label>
            <label>
              Win / loss reason (needed for Won or Lost stages)
              <select name="win_loss_reason" defaultValue={pending.deal?.win_loss_reason ?? ""}>
                <option value="">—</option>
                {[...new Set([...WIN_REASONS, ...LOSS_REASONS])].map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
            <label>Reason notes<textarea name="win_loss_note" rows={2} defaultValue={pending.deal?.win_loss_note ?? ""} /></label>
            <label>Notes<textarea name="notes" rows={3} maxLength={4000} defaultValue={pending.deal?.notes ?? ""} /></label>
            <div className="dialog-actions">
              <button className="secondary-button" type="button" onClick={() => setPending(null)}>Cancel</button>
              <button className="primary-button" type="submit">{pending.deal ? "Save deal" : "Add deal"}</button>
            </div>
          </form>
        </Dialog>
      )}

      {pending?.type === "close" && (
        <Dialog
          title={`${pending.stage.kind === "won" ? "Mark as won" : "Mark as lost"}: ${pending.deal.title}`}
          onClose={() => setPending(null)}
        >
          <form className="client-form" action={(fd) => void confirmClose(pending.deal, pending.stage, fd)}>
            <label>
              {pending.stage.kind === "won" ? "Why did we win?" : "Why did we lose?"}
              <select name="win_loss_reason" required defaultValue="">
                <option value="">Choose a reason…</option>
                {(pending.stage.kind === "won" ? WIN_REASONS : LOSS_REASONS).map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
            <label>Notes (optional)<textarea name="win_loss_note" rows={3} /></label>
            <div className="dialog-actions">
              <button className="secondary-button" type="button" onClick={() => setPending(null)}>Cancel</button>
              <button className="primary-button" type="submit">{pending.stage.kind === "won" ? "Mark won" : "Mark lost"}</button>
            </div>
          </form>
        </Dialog>
      )}

      {pending?.type === "stages" && (
        <StagesDialog
          client={client}
          stages={stages}
          deals={deals}
          onClose={() => setPending(null)}
          onChanged={load}
          onError={onError}
        />
      )}
    </section>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {detail && <div className="stat-detail">{detail}</div>}
    </div>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="editor-dialog deal-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">DEALS</p>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function StagesDialog({
  client,
  stages,
  deals,
  onClose,
  onChanged,
  onError,
}: {
  client: SupabaseClient;
  stages: Stage[];
  deals: Deal[];
  onClose: () => void;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const onlyOfKind = (k: StageKind) => stages.filter((s) => s.kind === k).length < 2;

  async function exec(p: PromiseLike<{ error: { message: string } | null }>, fallback: string) {
    onError("");
    const { error } = await p;
    if (error) {
      onError(`${fallback} ${error.message}`);
      return;
    }
    await onChanged();
  }

  async function move(i: number, dir: -1 | 1) {
    const a = stages[i];
    const b = stages[i + dir];
    if (!b) return;
    const [x, y] = await Promise.all([
      client.from("crm_deal_stages").update({ position: b.position }).eq("id", a.id),
      client.from("crm_deal_stages").update({ position: a.position }).eq("id", b.id),
    ]);
    if (x.error || y.error) return onError("Could not reorder. Only the admin can change stages.");
    await onChanged();
  }

  async function remove(s: Stage) {
    if (deals.some((d) => d.stage_id === s.id)) return onError("Move this stage’s deals to another stage before deleting it.");
    if (s.kind !== "open" && onlyOfKind(s.kind)) return onError(`Keep at least one ${s.kind} stage.`);
    if (!window.confirm(`Delete the stage “${s.name}”?`)) return;
    await exec(client.from("crm_deal_stages").delete().eq("id", s.id), "Could not delete the stage.");
  }

  return (
    <Dialog title="Customize stages" onClose={onClose}>
      <p className="module-footnote">
        Probability is the default for deals in that stage. Won and Lost stages close a deal and ask for a reason.
      </p>
      <div className="stage-list">
        {stages.map((s, i) => (
          <div className="stage-row" key={s.id}>
            <input
              defaultValue={s.name}
              aria-label="Stage name"
              onBlur={(e) => {
                const n = e.target.value.trim();
                if (!n) e.target.value = s.name;
                else if (n !== s.name) void exec(client.from("crm_deal_stages").update({ name: n }).eq("id", s.id), "Could not save the stage.");
              }}
            />
            <input
              type="number"
              min={0}
              max={100}
              defaultValue={s.probability}
              aria-label="Default probability %"
              title="Default probability %"
              onBlur={(e) => {
                const p = Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0)));
                if (p !== s.probability) void exec(client.from("crm_deal_stages").update({ probability: p }).eq("id", s.id), "Could not save the stage.");
              }}
            />
            <select
              className="status-select"
              aria-label="Stage type"
              value={s.kind}
              onChange={(e) => {
                if (s.kind !== "open" && onlyOfKind(s.kind)) return onError(`Keep at least one ${s.kind} stage.`);
                void exec(client.from("crm_deal_stages").update({ kind: e.target.value }).eq("id", s.id), "Could not save the stage.");
              }}
            >
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
            <button className="table-action" disabled={i === 0} aria-label="Move up" onClick={() => void move(i, -1)}>↑</button>
            <button className="table-action" disabled={i === stages.length - 1} aria-label="Move down" onClick={() => void move(i, 1)}>↓</button>
            <button className="table-action danger" onClick={() => void remove(s)}>Delete</button>
          </div>
        ))}
      </div>
      <div className="stage-row stage-add">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New stage name" aria-label="New stage name" />
        <button
          className="primary-button"
          onClick={async () => {
            const n = name.trim();
            if (!n) return onError("Enter a stage name.");
            await exec(
              client.from("crm_deal_stages").insert({
                name: n,
                position: Math.max(0, ...stages.map((s) => s.position)) + 1,
                probability: 50,
                kind: "open",
              }),
              "Could not add the stage. Only the admin can change stages.",
            );
            setName("");
          }}
        >
          Add stage
        </button>
      </div>
      <div className="dialog-actions">
        <button className="primary-button" onClick={onClose}>Done</button>
      </div>
    </Dialog>
  );
}
