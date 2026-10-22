"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export function NavAuth() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    void getSupabase()?.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);
  return signedIn ? (
    <Link className="lp-btn lp-primary sm" href="/app">Open your CRM</Link>
  ) : (
    <>
      <Link className="lp-link" href="/login">Log in</Link>
      <Link className="lp-btn lp-primary sm" href="/login?mode=signup">Get started</Link>
    </>
  );
}
