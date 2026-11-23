import type { Metadata } from "next";
import Link from "next/link";
import { EYEBROW, LINK } from "@/components/homepage/ui";
import { BreadcrumbSchema } from "@/components/seo/breadcrumbs";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SmsOptInForm } from "@/components/sms-opt-in-form";
import { BUSINESS_EMAIL, BUSINESS_PHONE_DISPLAY, BUSINESS_PHONE_E164 } from "@/lib/author";
import { marketingMetadata } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";
import { LO_SMS_OPT_IN_PATH } from "@/lib/sms-program";

export function generateMetadata(): Metadata {
  return marketingMetadata({
    title: "Text Message Opt-In for Loan Officers | YPN USA",
    description:
      "Licensed mortgage loan officers can opt in to YPN USA text messages: account notices, borrower lead alerts, ZIP code territory updates, subscription alerts and Cerebro messages.",
    path: LO_SMS_OPT_IN_PATH,
    absoluteTitle: true,
    origin: MARKETING_SITE_URL,
  });
}

/**
 * Public text opt-in page for loan officers (no sign-in). US carriers review this page for the
 * YPN USA A2P 10DLC registration, so the wording comes from src/lib/sms-program.ts and the
 * consent box starts unticked.
 */
export default function SmsOptInPage() {
  return (
    <div className="ypn-light flex min-h-full flex-col bg-slate-50 text-slate-900">
      <SiteHeader tone="light" />
      <main id="main-content" className="flex-1 bg-slate-50">
        <BreadcrumbSchema items={[{ name: "Home", href: "/" }, { name: "Text message opt-in", href: LO_SMS_OPT_IN_PATH }]} />
        <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 md:py-16">
          <p className={EYEBROW}>Text messages</p>
          <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
            Get YPN USA updates by text
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-700">
            For licensed mortgage loan officers and loan originators. Opt in to receive text messages from YPN USA
            about your account, new borrower leads, your ZIP code territory, your subscription, and Cerebro, your AI
            assistant. Texting is optional and is not needed to use YPN USA.
          </p>

          <div className="mt-8">
            <SmsOptInForm />
          </div>

          <section aria-labelledby="sms-how-it-works" className="mt-10 text-sm leading-6 text-slate-700">
            <h2 id="sms-how-it-works" className="text-lg font-semibold text-slate-900">How texts from YPN USA work</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Texts come from YPN USA, operated by YPN Inc. Message frequency varies with your account activity.</li>
              <li>Message and data rates may apply, according to your mobile plan.</li>
              <li>
                Reply <strong>STOP</strong> to any message to opt out, or <strong>HELP</strong> for support. You can also
                reach us at <a href={`mailto:${BUSINESS_EMAIL}`} className={LINK}>{BUSINESS_EMAIL}</a> or{" "}
                <a href={`tel:${BUSINESS_PHONE_E164}`} className={LINK}>{BUSINESS_PHONE_DISPLAY}</a>.
              </li>
              <li>
                We never sell or share your mobile number or text opt-in with third parties or affiliates for
                marketing. See our <Link href="/privacy-policy#text-messages" className={LINK}>Privacy Policy</Link> and the
                text message terms in our <Link href="/terms-of-service#text-messages" className={LINK}>Terms of Service</Link>.
              </li>
            </ul>
          </section>
        </div>
      </main>
      <SiteFooter tone="light" />
    </div>
  );
}
