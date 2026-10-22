"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

/** Asks people who have not yet set a security question to set one. Used by the forgot-password flow. */
export function SecurityQuestionGate({ client }: { client: SupabaseClient }) {
  const [needed, setNeeded] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void client.rpc("orchid_sq_status").then(({ data, error: e }) => {
      if (!cancelled && !e && data && data.has === false) setNeeded(true);
    });
    return () => { cancelled = true; };
  }, [client]);

  if (!needed) return null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const { error: e } = await client.rpc("orchid_sq_set", { p_question: question, p_answer: answer });
    setSaving(false);
    if (e) { setError(e.message); return; }
    setNeeded(false);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="sq-title">
      <form className="modal-card" onSubmit={save} style={{ maxWidth: 420, margin: "10vh auto", background: "#fff", padding: 24, borderRadius: 16, display: "grid", gap: 12 }}>
        <h2 id="sq-title" style={{ margin: 0 }}>Set a security question</h2>
        <p style={{ margin: 0, color: "var(--muted)" }}>If you ever forget your password, answering this question lets you reset it.</p>
        <label>Question<input value={question} onChange={(e) => setQuestion(e.target.value)} minLength={8} maxLength={140} required placeholder="e.g. What was my first pet called?" style={{ width: "100%" }} /></label>
        <label>Answer<input value={answer} onChange={(e) => setAnswer(e.target.value)} minLength={4} maxLength={100} required style={{ width: "100%" }} /></label>
        {error && <div className="alert error" role="alert">{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          <button type="button" className="secondary-button" onClick={() => setNeeded(false)}>Not now</button>
        </div>
      </form>
    </div>
  );
}
