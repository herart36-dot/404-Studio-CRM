import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of Service | Hellobase CRM" };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated={site.updated}>
      <p>These terms govern your use of {site.name}, operated by {site.company}, {site.location}. By creating an account or using the service you agree to them.</p>
      <h2>Your account</h2>
      <p>You must give accurate information, keep your password safe and be at least 18. You are responsible for activity under your account and for the people you add as members.</p>
      <h2>Acceptable use</h2>
      <p>Do not use Hellobase to break the law, send spam, harass people, attempt to access other people&rsquo;s data, or interfere with the service. You are responsible for having the right to store and contact the people in your CRM.</p>
      <h2>Your data</h2>
      <p>You own the data you put into Hellobase. You give us permission to store and process it only to provide the service, as described in our <a href="/privacy">Privacy Policy</a>.</p>
      <h2>Plans, payment and trial</h2>
      <p>The service costs {site.price} a month unless a different price is shown at sign-up. New accounts may receive a trial period. You can cancel at any time, and cancellation takes effect at the end of the paid period.</p>
      <h2>AI assistant</h2>
      <p>AI replies may be wrong. Review every suggested change and email before you confirm it. You are responsible for what you confirm and send.</p>
      <h2>Availability and changes</h2>
      <p>We work to keep Hellobase running but do not guarantee it will always be available or error free. We may change or discontinue features with reasonable notice.</p>
      <h2>Liability</h2>
      <p>To the extent the law allows, the service is provided &ldquo;as is&rdquo; and our total liability is limited to the amount you paid us in the three months before the claim. Nothing here limits rights you have that cannot be limited by law.</p>
      <h2>Ending your account</h2>
      <p>You may stop using Hellobase at any time. We may suspend accounts that break these terms.</p>
      <h2>Governing law and contact</h2>
      <p>These terms are governed by the laws of the Philippines. Questions: <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.</p>
    </LegalPage>
  );
}
