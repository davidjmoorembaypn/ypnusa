import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/legal-page-layout";
import { PUBLIC_PRICING_TIERS, TRIAL_DAYS } from "@/lib/pricing";
import { CUSTOMER_PORTAL_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern use of app.ypnus.com and the YPN USA platform.",
};

const LAST_UPDATED = "September 24, 2026";

const PAID_PLAN_PRICES = PUBLIC_PRICING_TIERS.filter((tier) => tier.priceMonthlyCents > 0)
  .map((tier) => `${tier.name} ${tier.price}/month`)
  .join(", ");

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      lastUpdated={LAST_UPDATED}
      intro={
        <>
          These Terms of Service (&ldquo;Terms&rdquo;) govern access to and use of{" "}
          <strong>app.ypnus.com</strong> and the coordinated marketing site{" "}
          <strong>ypnus.com</strong> (together, the &ldquo;Platform&rdquo;), operated by YPN Inc.
          (&ldquo;YPN,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;). By creating an account,
          subscribing to a plan, or otherwise using the Platform, you agree to these Terms. If you
          do not agree, do not use the Platform.
        </>
      }
    >
      <h2>1. What the Platform is</h2>
      <p>
        YPN USA is a marketing-technology and lead-routing platform for licensed loan officers
        (&ldquo;Subscribers&rdquo;). It provides exclusive ZIP-code territory claims, an
        AI-assisted borrower intake experience, appointment scheduling, and related tools.{" "}
        <strong>
          YPN Inc. is not a mortgage lender, mortgage broker, or loan servicer, does not take loan
          applications, and does not make credit decisions.
        </strong>{" "}
        Nothing on the Platform is a commitment to lend or an offer of credit. All loan origination
        activity is conducted solely by the Subscriber and their sponsoring, properly licensed
        lender.
      </p>

      <h2>2. Eligibility and accounts</h2>
      <ul>
        <li>
          You must be at least 18 years old to create a Subscriber account. If you register as a
          loan officer, you represent that you hold all licenses (including any applicable NMLS
          registration) required to originate mortgage loans in the jurisdictions where you
          operate.
        </li>
        <li>You are responsible for the accuracy of your account information and for safeguarding your login credentials.</li>
        <li>You are responsible for all activity that occurs under your account.</li>
      </ul>

      <h2>3. Subscriptions, free trials, automatic renewal, and cancellation</h2>
      <ul>
        <li>
          <strong>Plans and prices.</strong> Paid plans ({PAID_PLAN_PRICES}, or the price shown at
          checkout) are billed monthly in advance through our payment processor, Stripe.
        </li>
        <li>
          <strong>Free trial.</strong> Each paid plan starts with a {TRIAL_DAYS}-day free trial. We
          collect a payment method at sign-up but do not charge it during the trial. Unless you
          cancel before the trial ends, your subscription automatically converts to the paid plan
          you selected and your payment method is charged the monthly price when the trial ends.
        </li>
        <li>
          <strong>Automatic renewal.</strong> Your subscription renews automatically every month,
          and your payment method is charged the then-current monthly price, until you cancel. We
          will notify you before any price increase takes effect, and you may cancel before it
          applies.
        </li>
        <li>
          <strong>How to cancel.</strong> You can cancel online at any time, with no phone call or
          cancellation fee, from Billing in your account (
          <a href="/billing">app.ypnus.com/billing</a>) or through the{" "}
          <a href={CUSTOMER_PORTAL_URL}>Stripe billing portal</a>, or by emailing{" "}
          <a href="mailto:support@ypnus.com">support@ypnus.com</a>. Cancelling stops all future
          charges; your access, including any territory claim, continues through the end of the
          current billing period and then ends.
        </li>
        <li>
          A ZIP territory is exclusive to the Subscriber who currently holds it under an active
          subscription and is subject to the Platform&rsquo;s territory rules. Territory claims
          release automatically if the associated subscription lapses, and we do not guarantee any
          specific volume, quality, or continuity of leads.
        </li>
        <li>
          <strong>Refunds.</strong> Fees already charged are non-refundable except as required by law
          or as expressly stated at the time of purchase. You will not be charged after you cancel.
        </li>
      </ul>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          Use the Platform, including AI-generated or templated communications, in a way that
          violates the Fair Housing Act, the Equal Credit Opportunity Act, TILA, RESPA, TCPA, CAN-SPAM,
          or any other applicable law governing mortgage advertising, fair lending, or consumer
          communications.
        </li>
        <li>Misrepresent your licensing status, affiliation, or the terms of any loan product.</li>
        <li>Contact a Borrower who has opted out of communications, or use the Platform for any communication without the consent required by law.</li>
        <li>Reverse engineer, scrape, resell, or provide unauthorized third-party access to the Platform.</li>
        <li>Upload unlawful, infringing, or harmful content, or attempt to interfere with the Platform&rsquo;s security or operation.</li>
      </ul>

      <h2>5. AI-assisted features</h2>
      <p>
        Certain features (borrower chat, drafted replies, qualification scoring, appointment
        suggestions) are generated with the assistance of automated or AI systems. These outputs
        may be inaccurate, incomplete, or unsuitable for a given situation and{" "}
        <strong>do not constitute legal, financial, or credit advice</strong>. Subscribers are
        solely responsible for reviewing any AI-assisted output before relying on it or sending it
        to a Borrower, and for ensuring their own communications comply with applicable law.
      </p>

      <h2>6. Intellectual property</h2>
      <p>
        The Platform, including its software, design, and content, is owned by YPN Inc. or its
        licensors and is protected by intellectual property law. Subscribers receive a limited,
        non-exclusive, non-transferable license to use the Platform for its intended business
        purpose during an active subscription. No other rights are granted.
      </p>

      <h2>7. Third-party services</h2>
      <p>
        The Platform integrates with third-party services (including Stripe, Twilio, and mapping
        or lookup providers) and links to ypnus.com. Your use of those services is governed by
        their own terms and privacy policies, and YPN Inc. is not responsible for third-party
        services outside its control.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        THE PLATFORM IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT
        WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT
        THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT ANY PARTICULAR VOLUME OF
        LEADS, TERRITORY AVAILABILITY, OR BUSINESS RESULT WILL OCCUR.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, YPN INC. WILL NOT BE LIABLE FOR ANY INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE,
        OR DATA, ARISING FROM YOUR USE OF THE PLATFORM. YPN INC.&rsquo;S TOTAL LIABILITY FOR ANY
        CLAIM RELATING TO THE PLATFORM WILL NOT EXCEED THE AMOUNT YOU PAID TO YPN INC. IN THE
        TWELVE MONTHS BEFORE THE CLAIM AROSE.
      </p>

      <h2>10. Indemnification</h2>
      <p>
        You agree to indemnify and hold YPN Inc. harmless from any claim arising from your use of
        the Platform, your content, or your violation of these Terms or applicable law, including
        fair lending and consumer-communication laws applicable to your business.
      </p>

      <h2>11. Termination</h2>
      <p>
        You may cancel your subscription at any time. We may suspend or terminate access to the
        Platform for a violation of these Terms, non-payment, or conduct that creates legal or
        regulatory risk for YPN Inc. or its users.
      </p>

      <h2>12. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of the State of California, without regard to
        conflict-of-laws principles. Before filing a claim, you agree to contact us first at the
        address in Section 14 so we can attempt to resolve the dispute informally. Any dispute not
        resolved informally will be subject to the exclusive jurisdiction of the state or federal
        courts located in Tulare County, California.
      </p>

      <h2>13. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. The &ldquo;Last updated&rdquo; date above
        reflects the most recent revision. Continued use of the Platform after a change
        constitutes acceptance of the updated Terms.
      </p>

      <h2>14. Contact us</h2>
      <p>
        YPN Inc. &middot; 247 N L Street, Dinuba, CA 93618
        <br />
        Email: <a href="mailto:support@ypnus.com">support@ypnus.com</a>
        <br />
        Phone: <a href="tel:+15595120372">(559) 512-0372</a>
      </p>
    </LegalPageLayout>
  );
}
