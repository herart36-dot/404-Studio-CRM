import Link from "next/link";
import { NavAuth } from "@/components/NavAuth";
import { site } from "@/lib/site";
import "./landing.css";

const faqs = [
  ["How do I log in?", "Use your email and password, or continue with Google. New here? Create your account in under a minute."],
  ["Is my data shared with other businesses?", "No. Your CRM data stays with your team, and only members your admin approves can open it."],
  ["How much does it cost?", `${site.price} a month, with no per-seat maze. Cancel anytime.`],
  ["Does it work on my phone?", "Yes. It is phone friendly and made so there is nothing to learn."],
  ["Who is it for?", "Freelancers, solo entrepreneurs and small businesses."],
  ["Does the AI change things on its own?", "No. Hello shows every change as a card first. Nothing happens until you confirm, and team members' edits go to an admin for approval."],
];

export default function Landing() {
  return (
    <>
      <header className="lp-nav">
        <Link href="/" className="lp-logo">hellobase<span>.</span></Link>
        <nav aria-label="Primary">
          <a href="#features">Features</a><a href="#hello">AI assistant</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a>
        </nav>
        <div className="lp-nav-act"><NavAuth /></div>
      </header>

      <main>
        <section className="lp-hero">
          <h1>Know who&rsquo;s waiting on you, before they go cold.</h1>
          <p>{site.name} shows you who is waiting for a reply, who has gone quiet, and what to do today, so nothing slips while you run your business. {site.price} a month, no sales call.</p>
          <div className="lp-cta">
            <Link className="lp-btn lp-primary" href="/login?mode=signup">Get started</Link>
            <a className="lp-btn lp-ghost" href="#pricing">See pricing</a>
          </div>
          <p className="lp-note">Already have an account? <Link href="/login">Log in</Link></p>

          <div className="lp-mock" role="img" aria-label="Sample overview with waiting inquiries, going-cold clients and the Hello assistant">
            <div className="lp-mock-top"><b>Overview</b><span>Sample data</span></div>
            <div className="lp-mock-grid">
              <div><h3>Waiting longest</h3>
                <p><b>Maria Santos</b><em className="hot">Waiting 41m</em></p>
                <p><b>Cafe Luna</b><em className="hot">Waiting 2h 10m</em></p>
                <p><b>J. Reyes</b><em className="cold">Going cold · 6d</em></p>
              </div>
              <div><h3>Tasks today</h3>
                <p><b>Send quote to Cafe Luna</b><em>High</em></p>
                <p><b>Call Northwind Dental</b><em>Today</em></p>
              </div>
              <div className="lp-mock-ai"><h3>Hello, your assistant</h3>
                <p className="q">Who has gone quiet this week?</p>
                <p>2 clients: Dana Cruz (6 days) and Ben Ortiz (5 days). Want me to draft a follow-up for each?</p>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-who" aria-label="Who it is for">
          <div><b>Freelancers</b><span>Keep every client, quote and deadline in one list instead of your inbox.</span></div>
          <div><b>Solo entrepreneurs</b><span>See who needs a reply today, without building a system first.</span></div>
          <div><b>Small businesses</b><span>Share one client list and one chat log per client with your team.</span></div>
        </section>

        <section className="lp-sec" id="problem">
          <h2>Inquiries don&rsquo;t get ignored. They get buried.</h2>
          <p className="lp-lead">A message arrives while you are busy. A day later it is under twenty others, and the person has moved on. {site.name} puts a clock on every inquiry so the oldest one is always at the top.</p>
        </section>

        <section className="lp-sec alt" id="features">
          <h2>Everything a small team needs, nothing it doesn&rsquo;t.</h2>
          <div className="lp-cards">
            <article><h3>Live waiting timer</h3><p>Every new inquiry shows how long it has been waiting, longest first.</p></article>
            <article><h3>Going-cold alerts</h3><p>See who has gone quiet for two days or more before they are gone for good.</p></article>
            <article><h3>Clients and tasks</h3><p>One client list, one task list, one place for notes. Phone friendly.</p></article>
            <article><h3>Cases with SLA tracking</h3><p>Route support requests and track response times so nothing is missed.</p></article>
            <article><h3>Team chat log</h3><p>Keep a chat log for every client so the whole team stays in the loop.</p></article>
            <article><h3>Deals pipeline</h3><p>Drag deals between stages, record win and loss reasons and see your totals.</p></article>
          </div>
        </section>

        <section className="lp-sec" id="hello">
          <h2>Tell Hello what you need. It gets the work done.</h2>
          <p className="lp-lead">Hello reads your inquiries, clients and tasks, tells you what needs you today and adds records when you ask. You approve every change before it happens.</p>
          <ul className="lp-checks">
            <li>Say &ldquo;Add a task for tomorrow: call Cafe Luna&rdquo; and review the card.</li>
            <li>Team members&rsquo; edits go to an admin for approval first.</li>
            <li>Your AI key never sits in your browser.</li>
          </ul>
        </section>

        <section className="lp-sec alt" id="how">
          <h2>From sign-up to your day in three steps.</h2>
          <div className="lp-steps">
            <div><b>1</b><h3>Create your account</h3><p>Use your email or Google. It takes about a minute.</p></div>
            <div><b>2</b><h3>Land in your CRM</h3><p>You go straight to your CRM, with nothing to choose.</p></div>
            <div><b>3</b><h3>Get on with your day</h3><p>Everything is private to you and your team.</p></div>
          </div>
        </section>

        <section className="lp-sec" id="pricing">
          <div className="lp-price">
            <div><h2>Your own CRM for {site.price} a month.</h2><p className="lp-lead">No sales call, no per-seat maze. One simple price.</p></div>
            <div className="lp-price-card">
              <div className="amt">{site.price}<small> a month</small></div>
              <ul>
                <li>Inquiries with a live waiting timer</li><li>Clients, tasks and cases in one place</li>
                <li>SLA tracking</li><li>Team chat log for every client</li><li>The Hello AI assistant</li>
              </ul>
              <Link className="lp-btn lp-primary wide" href="/login?mode=signup">Get started</Link>
              <p className="lp-fine">Cancel anytime.</p>
            </div>
          </div>
        </section>

        <section className="lp-sec alt" id="faq">
          <h2>Good to know.</h2>
          <div className="lp-faq">
            {faqs.map(([q, a]) => (<details key={q}><summary>{q}</summary><p>{a}</p></details>))}
          </div>
        </section>

        <section className="lp-final">
          <h2>Ready to stop losing replies?</h2>
          <Link className="lp-btn lp-primary" href="/login?mode=signup">Get started</Link>
        </section>
      </main>

      <footer className="lp-foot">
        <span>&copy; {new Date().getFullYear()} {site.company}, {site.location}</span>
        <nav aria-label="Footer"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/login">Log in</Link></nav>
      </footer>
    </>
  );
}
