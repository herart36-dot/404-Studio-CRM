"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import "../landing.css";

type Mode = "signin" | "signup" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "signup") setMode("signup");
    const client = getSupabase();
    void client?.auth.getSession().then(({ data }) => { if (data.session) router.replace("/app"); });
  }, [router]);

  function switchMode(next: Mode) { setMode(next); setError(""); setNotice(""); setQuestion(""); setAnswer(""); }

  async function google() {
    const client = getSupabase();
    if (!client) return setError("The CRM is not connected to Supabase yet.");
    const { error: e } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/app` } });
    if (e) setError(e.message);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const client = getSupabase();
    if (!client) return setError("The CRM is not connected to Supabase yet.");
    setBusy(true); setError(""); setNotice("");
    try {
      if (mode === "signin") {
        const { error: e } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (e) throw e;
        router.replace("/app");
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
        const { data, error: e } = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/app` } });
        if (e) throw e;
        if (data.session) router.replace("/app");
        else setNotice("Check your email to confirm your account, then log in.");
      } else if (!question) {
        const { data, error: e } = await client.rpc("orchid_sq_question", { p_email: email.trim() });
        if (e) throw e;
        setQuestion(String(data));
      } else {
        if (password.length < 8) throw new Error("Use at least 8 characters for your new password.");
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/orchid-reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
          body: JSON.stringify({ email: email.trim(), answer, new_password: password }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Could not reset the password.");
        switchMode("signin");
        setNotice("Password changed. You can log in now.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signin" ? "Log in" : mode === "signup" ? "Create your account" : "Reset your password";
  return (
    <main className="auth">
      <div className="auth-card">
        <Link href="/" className="lp-logo">hellobase<span>.</span></Link>
        <h1>{title}</h1>
        {mode !== "forgot" && <button className="lp-btn lp-ghost wide" type="button" onClick={() => void google()}>Continue with Google</button>}
        {mode !== "forgot" && <div className="auth-or"><span>or</span></div>}
        <form onSubmit={submit}>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" disabled={Boolean(question)} /></label>
          {mode === "forgot" && question && (
            <>
              <p className="auth-q"><strong>Your security question:</strong> {question}</p>
              <label>Your answer<input value={answer} onChange={(e) => setAnswer(e.target.value)} required autoComplete="off" /></label>
            </>
          )}
          {(mode !== "forgot" || question) && (
            <label>{mode === "forgot" ? "New password" : "Password"}
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "signin" ? undefined : 8} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
            </label>
          )}
          {error && <div className="auth-msg err" role="alert">{error}</div>}
          {notice && <div className="auth-msg ok" role="status">{notice}</div>}
          <button className="lp-btn lp-primary wide" disabled={busy}>
            {busy ? "One moment…" : mode === "signin" ? "Log in" : mode === "signup" ? "Create account" : question ? "Change password" : "Continue"}
          </button>
        </form>
        <div className="auth-links">
          {mode === "signin" && <><button onClick={() => switchMode("forgot")}>Forgot password?</button><button onClick={() => switchMode("signup")}>New here? Create your account</button></>}
          {mode !== "signin" && <button onClick={() => switchMode("signin")}>Back to log in</button>}
        </div>
        <p className="auth-fine">By continuing you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
      </div>
    </main>
  );
}
