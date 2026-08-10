import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How we collect, use, and protect your personal information.",
};

const LAST_UPDATED = "August 9, 2026";
const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "SaaS Platform Inc.";
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "privacy@yourapp.dev";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="mb-8 inline-block text-sm text-zinc-500 hover:underline">
        ← Back to home
      </Link>
      <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">Privacy Policy</h1>
      <p className="mb-10 text-sm text-zinc-500">Last updated: {LAST_UPDATED}</p>

      <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8 text-zinc-700 dark:text-zinc-300">
        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">1. Introduction</h2>
          <p>
            {COMPANY_NAME} (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) operates this SaaS platform (the
            &ldquo;Service&rdquo;). This Privacy Policy explains how we collect, use, disclose, and safeguard your
            information when you use the Service.
          </p>
          <p>
            By using the Service you agree to the collection and use of information in accordance with this policy. If
            you do not agree, please discontinue use of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">2. Information We Collect</h2>
          <h3 className="mt-4 text-base font-semibold">Account &amp; Registration Data</h3>
          <p>
            When you register for an account we collect your email address, password (stored as a one-way hash), and
            the store name and subdomain you choose.
          </p>
          <h3 className="mt-4 text-base font-semibold">Store &amp; Transaction Data</h3>
          <p>
            Data you enter while operating your store — product details, orders, customer records, and inventory — is
            stored on your behalf and remains yours. We process it only to provide the Service.
          </p>
          <h3 className="mt-4 text-base font-semibold">Usage &amp; Log Data</h3>
          <p>
            We automatically collect log data including your IP address, browser type, pages visited, and actions
            taken within the Service for security, debugging, and analytics purposes.
          </p>
          <h3 className="mt-4 text-base font-semibold">Payment Data</h3>
          <p>
            Billing is handled by Stripe. We do not store full credit card numbers. Stripe&rsquo;s own privacy policy
            governs the data they process on your behalf.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">3. How We Use Your Information</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Provide, operate, and maintain the Service</li>
            <li>Process transactions and send related notices (order confirmations, invoices)</li>
            <li>Send transactional emails such as password resets and staff invitations</li>
            <li>Monitor and analyse usage to improve the Service</li>
            <li>Detect, prevent, and address technical issues and fraud</li>
            <li>Comply with legal obligations</li>
          </ul>
          <p>We do not sell your personal data to third parties.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">4. Data Retention</h2>
          <p>
            We retain your account data for as long as your account is active or as needed to provide the Service.
            Upon account cancellation you may request a data export; your data is deleted from our systems within 30
            days of account closure, except where we are required by law to retain it longer.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">5. Data Security</h2>
          <p>
            We implement industry-standard measures to protect your information including TLS in transit, hashed
            passwords, row-level database isolation between tenants, and periodic security reviews. No method of
            transmission over the internet is 100% secure; we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">6. Your Rights</h2>
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data (&ldquo;right to be forgotten&rdquo;)</li>
            <li>Object to or restrict certain processing</li>
            <li>Data portability (receive your data in a machine-readable format)</li>
          </ul>
          <p>
            To exercise any of these rights, email us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-600 hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">7. Cookies</h2>
          <p>
            We use only technically necessary cookies (authentication session tokens). We do not use advertising or
            tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">8. Third-Party Services</h2>
          <p>
            The Service integrates with third parties including Stripe (payments) and cloud storage providers. Each
            has its own privacy policy. We share only the minimum data necessary for each integration to function.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">9. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. We will notify you of material changes by email or by posting
            a prominent notice in the Service. Continued use after changes are posted constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">10. Contact</h2>
          <p>
            Questions about this policy? Contact us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-600 hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
