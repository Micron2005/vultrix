import Link from "next/link";
import type { Metadata } from "next";
import {
  APP_NAME,
  APP_OWNER,
  APP_OWNER_LINE,
  LEGAL_CONTACT_EMAIL,
  LEGAL_GOVERNING_LAW,
  LEGAL_LAST_UPDATED,
} from "@/lib/branding";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Privacy Policy — ${APP_NAME}`,
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="text-center">
          <div className="text-2xl font-bold tracking-tight text-zinc-900">
            {APP_NAME}
          </div>
          <h1 className="mt-1 text-lg font-semibold text-zinc-800">
            Privacy Policy
          </h1>
          <div className="text-xs text-zinc-500">
            Last updated: {LEGAL_LAST_UPDATED}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm leading-relaxed text-zinc-700 space-y-5">
          <p>
            This Privacy Policy explains how {APP_OWNER} (&ldquo;{APP_OWNER},
            &rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)
            handles information in connection with {APP_NAME} (the
            &ldquo;Service&rdquo;). By using the Service, you agree to this
            Policy and our{" "}
            <Link href="/terms" className="underline">
              Terms of Service
            </Link>
            .
          </p>

          <Section n="1" title="Information we collect">
            <p>We collect:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Account information</strong> — business name, username,
                billing email, and a securely hashed password.
              </li>
              <li>
                <strong>Business data you enter</strong> — your customers,
                vehicles, repair orders, invoices, inventory, and related
                records (&ldquo;Business Data&rdquo;).
              </li>
              <li>
                <strong>Payment information</strong> — processed by our payment
                processor (Stripe). We do not store full card numbers; Stripe
                handles card data under its own security and privacy practices.
              </li>
              <li>
                <strong>Technical data</strong> — basic logs such as IP address,
                browser type, and usage needed to operate and secure the
                Service.
              </li>
            </ul>
          </Section>

          <Section n="2" title="How we use information">
            <p>
              We use information to provide, maintain, secure, and improve the
              Service; to process subscriptions and payments; to communicate with
              you about your account; to provide support; and to comply with
              legal obligations. We do not sell your personal information.
            </p>
          </Section>

          <Section n="3" title="Business Data and your role">
            <p>
              You control the Business Data you enter, including information
              about your own customers. As between you and us, that data is
              yours, and you are responsible for having any rights and consents
              needed to collect and store it and for handling it in accordance
              with applicable law. We process Business Data on your behalf solely
              to provide the Service.
            </p>
          </Section>

          <Section n="4" title="How we share information">
            <p>
              We share information only with service providers that help us run
              the Service (such as hosting and payment processing) under
              appropriate confidentiality obligations; when required by law or to
              respond to lawful requests; to protect the rights, safety, and
              security of {APP_OWNER}, our users, or the public; and in
              connection with a business transfer (such as a merger or
              acquisition). Each business&rsquo;s data is logically separated so
              one business cannot access another&rsquo;s data.
            </p>
          </Section>

          <Section n="5" title="Data retention">
            <p>
              We retain information for as long as your account is active and as
              needed to provide the Service, comply with our legal obligations,
              resolve disputes, and enforce our agreements. After account
              termination we may delete your data; export anything you need
              beforehand.
            </p>
          </Section>

          <Section n="6" title="Security">
            <p>
              We use reasonable administrative and technical measures designed to
              protect information, including encrypted connections and hashed
              passwords. However, no method of transmission or storage is
              completely secure, and we cannot guarantee absolute security. You
              are responsible for keeping your login credentials confidential.
            </p>
          </Section>

          <Section n="7" title="Your choices">
            <p>
              You may access and update most account and Business Data directly
              in the Service. You may request deletion of your account by
              contacting us. Depending on where you live, you may have additional
              rights over your personal information under applicable law; contact
              us to exercise them.
            </p>
          </Section>

          <Section n="8" title="Children">
            <p>
              The Service is intended for businesses and is not directed to
              children under 18. We do not knowingly collect personal information
              from children.
            </p>
          </Section>

          <Section n="9" title="Changes to this Policy">
            <p>
              We may update this Policy from time to time. We will revise the
              &ldquo;Last updated&rdquo; date above, and material changes take
              effect upon posting. Your continued use of the Service after
              changes become effective constitutes acceptance.
            </p>
          </Section>

          <Section n="10" title="Contact">
            <p>
              Questions about this Policy or your data? Contact us at{" "}
              <a
                href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                className="font-medium text-zinc-900 underline"
              >
                {LEGAL_CONTACT_EMAIL}
              </a>
              . This Policy is governed by the laws of {LEGAL_GOVERNING_LAW}.
            </p>
          </Section>
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-zinc-500">
          <Link href="/signup" className="font-medium text-zinc-700 underline">
            Back to sign-up
          </Link>
          <Link href="/terms" className="font-medium text-zinc-700 underline">
            Terms of Service
          </Link>
        </div>
        <div className="text-center text-[11px] text-zinc-400">
          {APP_OWNER_LINE}
        </div>
      </div>
    </div>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-zinc-900">
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}
