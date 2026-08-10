import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms and conditions governing your use of the platform.",
};

const LAST_UPDATED = "August 9, 2026";
const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "SaaS Platform Inc.";
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "legal@yourapp.dev";

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="mb-8 inline-block text-sm text-zinc-500 hover:underline">
        ← Back to home
      </Link>
      <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">Terms of Service</h1>
      <p className="mb-10 text-sm text-zinc-500">Last updated: {LAST_UPDATED}</p>

      <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8 text-zinc-700 dark:text-zinc-300">
        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">1. Acceptance of Terms</h2>
          <p>
            By creating an account or using the Service provided by {COMPANY_NAME} (&ldquo;we&rdquo;, &ldquo;our&rdquo;,
            or &ldquo;us&rdquo;) you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not
            agree, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">2. Description of Service</h2>
          <p>
            We provide a multi-tenant commerce platform that allows merchants to create and operate online stores,
            manage products and inventory, process orders, and connect with customers (&ldquo;Service&rdquo;). The
            Service is provided &ldquo;as is&rdquo; subject to these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">3. Account Registration</h2>
          <p>
            You must provide accurate and complete information when registering. You are responsible for maintaining
            the confidentiality of your credentials and for all activity that occurs under your account. Notify us
            immediately of any unauthorised use.
          </p>
          <p>
            You must be at least 18 years of age to use the Service. By registering you represent that you meet this
            requirement.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">4. Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Violate any applicable law or regulation</li>
            <li>Sell prohibited, illegal, or counterfeit goods</li>
            <li>Transmit spam, malware, or harmful code</li>
            <li>Infringe the intellectual property rights of others</li>
            <li>Harass, abuse, or harm other users</li>
            <li>Attempt to gain unauthorised access to the Service or its infrastructure</li>
            <li>Resell or sublicense access to the Service without our written consent</li>
          </ul>
          <p>We reserve the right to suspend or terminate accounts that violate these rules.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">5. Fees &amp; Payment</h2>
          <p>
            Certain features of the Service are available only on paid subscription plans. Prices are listed on our
            pricing page. Subscriptions auto-renew at the end of each billing period unless cancelled. All fees are
            non-refundable except as required by applicable law.
          </p>
          <p>
            If a payment fails, we will notify you and provide a grace period to resolve the billing issue. Failure to
            resolve payment may result in account suspension.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">6. Your Content</h2>
          <p>
            You retain ownership of all content you upload or create within the Service (&ldquo;Your Content&rdquo;).
            By using the Service you grant us a limited, non-exclusive, royalty-free licence to store, process, and
            transmit Your Content solely as necessary to provide the Service.
          </p>
          <p>
            You are solely responsible for Your Content and represent that you have all rights necessary to grant this
            licence.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">7. Intellectual Property</h2>
          <p>
            The Service, its software, design, and branding are the exclusive property of {COMPANY_NAME} and are
            protected by intellectual property laws. Nothing in these Terms transfers any intellectual property rights
            to you.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">8. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, {COMPANY_NAME} shall not be liable for any indirect, incidental,
            special, consequential, or punitive damages arising from your use of the Service, even if we have been
            advised of the possibility of such damages.
          </p>
          <p>
            Our total cumulative liability to you for any claim arising from or relating to the Service shall not
            exceed the fees you paid us in the three months preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">9. Disclaimer of Warranties</h2>
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind,
            either express or implied, including but not limited to warranties of merchantability, fitness for a
            particular purpose, and non-infringement.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">10. Termination</h2>
          <p>
            Either party may terminate these Terms at any time. Upon termination your access to the Service will be
            revoked. You may request a data export before terminating your account. We will delete your data within 30
            days of account closure per our data retention policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">11. Governing Law</h2>
          <p>
            These Terms are governed by and construed in accordance with applicable law. Any disputes shall be
            resolved in the courts of competent jurisdiction.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">12. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. We will notify you by email or via an in-app notice at least
            14 days before material changes take effect. Continued use of the Service after changes take effect
            constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">13. Contact</h2>
          <p>
            Questions about these Terms? Contact us at{" "}
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
