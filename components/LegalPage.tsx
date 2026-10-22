import Link from "next/link";
import "../app/landing.css";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <header className="lp-nav"><Link href="/" className="lp-logo">hellobase<span>.</span></Link><div className="lp-nav-act"><Link className="lp-link" href="/login">Log in</Link></div></header>
      <main className="legal"><h1>{title}</h1><p className="lp-fine">Last updated {updated}</p>{children}</main>
      <footer className="lp-foot"><span>&copy; {new Date().getFullYear()} 404 Studio</span><nav><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></footer>
    </>
  );
}
