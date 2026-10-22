import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy Policy | Hellobase CRM" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated={site.updated}>
      <p>{site.name} (&ldquo;Hellobase&rdquo;, &ldquo;we&rdquo;) is operated by {site.company}, {site.location}. This policy explains what we collect, why, and the choices you have. We handle personal data in line with the Philippine Data Privacy Act of 2012 (RA 10173).</p>
      <h2>What we collect</h2>
      <ul>
        <li><b>Account data:</b> your name, email address and sign-in method (password or Google).</li>
        <li><b>CRM data you add:</b> inquiries, clients, tasks, cases, deals, notes and messages, including the personal details of your own customers.</li>
        <li><b>Google data, only if you connect it:</b> Gmail messages you choose to sync or send, and Google Calendar events you create from the CRM.</li>
        <li><b>Basic usage data:</b> sign-in times and activity logs needed to keep the service secure.</li>
      </ul>
      <h2>How we use it</h2>
      <p>To run the CRM for you and your team, keep it secure, and provide support. We do not sell personal data and we do not use it for advertising.</p>
      <h2>Google user data</h2>
      <p>{site.name}&rsquo;s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements. We use Gmail and Calendar access only to show your emails, send emails you write, and create calendar events you ask for, inside the CRM. We do not use it for advertising, we do not allow humans to read it except with your consent, for security, or to comply with law, and we do not transfer it to others except to provide the feature you use. You can disconnect Google at any time in the CRM or at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.</p>
      <h2>AI assistant</h2>
      <p>When you use Hello, the text of your message and the CRM information needed to answer it is sent to our AI provider to produce a reply. Changes are only made after you confirm them.</p>
      <h2>Where data is stored and who we share it with</h2>
      <p>Data is stored with our hosting and database provider (Supabase). We share data only with service providers that help us run Hellobase (hosting, email delivery, AI and payments), under their own security and privacy terms, or when the law requires it.</p>
      <h2>Retention and deletion</h2>
      <p>We keep your data while your account is active. You can ask us to delete your account and CRM data at any time and we will do so within a reasonable period, except where we must keep records by law.</p>
      <h2>Your rights</h2>
      <p>You may ask to access, correct, export or delete your personal data, and to withdraw consent, by contacting us below.</p>
      <h2>Security</h2>
      <p>Access is limited to approved members, data is protected by row-level security, and secrets such as AI keys are kept on the server and never in your browser. No system is perfectly secure, so please use a strong password.</p>
      <h2>Children</h2>
      <p>Hellobase is not meant for people under 18.</p>
      <h2>Changes and contact</h2>
      <p>We will update the date above when this policy changes. Questions: <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.</p>
    </LegalPage>
  );
}
