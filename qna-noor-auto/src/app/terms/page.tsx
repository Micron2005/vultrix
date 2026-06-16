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
  title: `Terms of Service — ${APP_NAME}`,
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="text-center">
          <div className="text-2xl font-bold tracking-tight text-zinc-900">
            {APP_NAME}
          </div>
          <h1 className="mt-1 text-lg font-semibold text-zinc-800">
            Terms of Service
          </h1>
          <div className="text-xs text-zinc-500">
            Last updated: {LEGAL_LAST_UPDATED}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm leading-relaxed text-zinc-700 space-y-5">
          <p>
            These Terms of Service (the &ldquo;Terms&rdquo;) govern your access
            to and use of {APP_NAME} (the &ldquo;Service&rdquo;), a shop
            management platform operated by {APP_OWNER} (&ldquo;{APP_OWNER}
            ,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).
            By creating an account, accessing, or using the Service, you agree
            to be bound by these Terms. If you do not agree, do not use the
            Service.
          </p>

          <Section n="1" title="The Service">
            <p>
              {APP_NAME} provides software tools to help automotive and similar
              businesses manage customers, vehicles, repair orders, invoices,
              inventory, and related records. The Service is a software platform
              only. We are not a party to any transaction between you and your
              customers, we do not perform automotive work, and we do not
              provide automotive, financial, accounting, tax, or legal advice.
            </p>
          </Section>

          <Section n="2" title="Eligibility and accounts">
            <p>
              You must be at least 18 years old and able to form a binding
              contract to use the Service. You are responsible for all activity
              under your account, for keeping your login credentials secure, and
              for ensuring that everyone you authorize to use your account
              complies with these Terms. Notify us promptly of any unauthorized
              use.
            </p>
          </Section>

          <Section n="3" title="Subscriptions, billing and trials">
            <p>
              Paid plans are billed on a recurring basis through our third-party
              payment processor (Stripe). By subscribing, you authorize us and
              our processor to charge your payment method on each billing cycle
              until you cancel. Free trials, if offered, convert to paid
              subscriptions unless cancelled before the trial ends.
            </p>
            <p>
              Except where required by law, payments are{" "}
              <strong>non-refundable</strong>, and we do not provide refunds or
              credits for partial periods, unused time, or features not used. We
              may change prices or plan features on a prospective basis; we will
              make reasonable efforts to notify you in advance, and continued use
              after a change constitutes acceptance.
            </p>
            <p>
              If a payment fails, we may suspend or limit access to your account
              after a grace period and, if the failure is not resolved,
              terminate the account. You remain responsible for amounts owed.
            </p>
          </Section>

          <Section n="4" title="Your data and responsibilities">
            <p>
              You retain ownership of the data you submit to the Service (your
              &ldquo;Content&rdquo;), including your customer, vehicle, and
              business records. You grant us a limited license to host, process,
              and transmit your Content solely to operate and provide the
              Service.
            </p>
            <p>
              You are solely responsible for your Content and for your business,
              including: the accuracy of estimates, invoices, prices, and
              records you create; the quality and outcome of any work you
              perform for your customers; your relationships and disputes with
              your customers; collecting and remitting any applicable taxes; and
              complying with all laws that apply to your business, including
              consumer-protection, automotive-repair, privacy, and data-handling
              laws. You are responsible for obtaining any consents required to
              store and process information about your customers in the Service.
            </p>
          </Section>

          <Section n="5" title="Acceptable use">
            <p>You agree not to: use the Service for any unlawful, fraudulent,
              or infringing purpose; upload malicious code; attempt to gain
              unauthorized access to the Service or other accounts; interfere
              with or disrupt the Service; resell or provide the Service to third
              parties except as expressly permitted; or use the Service to store
              or transmit content that violates the rights of others. We may
              suspend or terminate accounts that violate this section.
            </p>
          </Section>

          <Section n="6" title="Third-party services">
            <p>
              The Service relies on third-party providers (for example, payment
              processing, hosting, and data lookups). Your use of those features
              may be subject to the third party&rsquo;s terms, and we are not
              responsible for the acts, omissions, availability, or content of
              any third-party service.
            </p>
          </Section>

          <Section n="7" title="Disclaimer of warranties">
            <p className="font-medium text-zinc-800">
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
              AVAILABLE,&rdquo; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS,
              IMPLIED, OR STATUTORY.
            </p>
            <p>
              To the fullest extent permitted by law, {APP_OWNER} disclaims all
              warranties, including implied warranties of merchantability,
              fitness for a particular purpose, title, and non-infringement. We
              do not warrant that the Service will be uninterrupted, secure,
              error-free, or free of data loss, or that it will meet your
              requirements. You are responsible for maintaining your own backups
              of important data. Any material you rely on from the Service is at
              your own risk.
            </p>
          </Section>

          <Section n="8" title="Limitation of liability">
            <p className="font-medium text-zinc-800">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, {APP_OWNER.toUpperCase()}{" "}
              AND ITS OWNERS, EMPLOYEES, AND SUPPLIERS WILL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE
              DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR
              BUSINESS, ARISING OUT OF OR RELATED TO THE SERVICE OR THESE TERMS,
              EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p>
              Our total aggregate liability for all claims arising out of or
              related to the Service or these Terms will not exceed the greater
              of (a) the total amount you paid us for the Service in the three
              (3) months immediately before the event giving rise to the claim,
              or (b) one hundred U.S. dollars ($100). Some jurisdictions do not
              allow certain limitations, so some of the above may not apply to
              you; in that case our liability is limited to the smallest amount
              permitted by law.
            </p>
          </Section>

          <Section n="9" title="Indemnification">
            <p>
              You agree to defend, indemnify, and hold harmless {APP_OWNER} and
              its owners, employees, and agents from and against any claims,
              damages, liabilities, losses, costs, and expenses (including
              reasonable attorneys&rsquo; fees) arising out of or related to:
              your use of the Service; your Content; your business, products, or
              services; your relationships or disputes with your customers; or
              your violation of these Terms or any law.
            </p>
          </Section>

          <Section n="10" title="Suspension and termination">
            <p>
              You may stop using the Service and cancel your subscription at any
              time. We may suspend or terminate your access at any time, with or
              without notice, including for non-payment or violation of these
              Terms. Upon termination, your right to use the Service ends. We may
              delete your Content after termination; export anything you need
              beforehand. Sections that by their nature should survive
              (including payment obligations, disclaimers, limitation of
              liability, and indemnification) survive termination.
            </p>
          </Section>

          <Section n="11" title="Changes to these Terms">
            <p>
              We may update these Terms from time to time. When we do, we will
              revise the &ldquo;Last updated&rdquo; date above. Material changes
              will take effect upon posting, and your continued use of the
              Service after changes become effective constitutes acceptance of
              the revised Terms.
            </p>
          </Section>

          <Section n="12" title="Governing law">
            <p>
              These Terms are governed by the laws of {LEGAL_GOVERNING_LAW},
              without regard to its conflict-of-laws rules. You agree that the
              exclusive venue for any dispute that may be brought in court will
              be the state and federal courts located in {LEGAL_GOVERNING_LAW},
              and you consent to their jurisdiction. If any provision of these
              Terms is held unenforceable, the remaining provisions remain in
              full effect.
            </p>
          </Section>

          <Section n="13" title="Contact">
            <p>
              Questions about these Terms? Contact us at{" "}
              <a
                href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                className="font-medium text-zinc-900 underline"
              >
                {LEGAL_CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <p className="border-t border-zinc-200 pt-4 text-xs text-zinc-500">
            By using {APP_NAME}, you acknowledge that you have read, understood,
            and agree to these Terms of Service and our{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-zinc-500">
          <Link href="/signup" className="font-medium text-zinc-700 underline">
            Back to sign-up
          </Link>
          <Link href="/privacy" className="font-medium text-zinc-700 underline">
            Privacy Policy
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
