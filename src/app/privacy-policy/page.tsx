import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/legal-page-layout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How YPN Inc. collects, uses, and protects information on app.ypnus.com and through the YPN USA platform.",
};

const LAST_UPDATED = "September 24, 2026";

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      intro={
        <>
          This Privacy Policy explains how YPN Inc. (&ldquo;YPN,&rdquo; &ldquo;YPN USA,&rdquo;
          &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, discloses, and
          protects information in connection with <strong>app.ypnus.com</strong> (this platform)
          and its coordinated marketing site, <strong>ypnus.com</strong>. It applies to loan
          officers who subscribe to the YPN USA platform (&ldquo;Subscribers&rdquo;) and to
          consumers who interact with a Subscriber&rsquo;s territory page, ZIP-availability
          checker, AI intake assistant, equity snapshot tool, or phone line (&ldquo;Visitors&rdquo;
          or &ldquo;Borrowers&rdquo;).
        </>
      }
    >
      <h2>1. Who we are</h2>
      <p>
        YPN Inc. operates YPN USA, a mortgage growth platform that lets licensed loan officers
        claim exclusive ZIP-code territories and capture local borrower interest through AI-guided
        intake. <strong>YPN Inc. is not a mortgage lender and does not make credit decisions.</strong>{" "}
        Nothing on this platform is a commitment to lend. Loan origination, underwriting, and
        credit decisions are made exclusively by the licensed Subscriber (loan officer) and their
        sponsoring lender.
      </p>

      <h2>2. Information we collect</h2>
      <h3>2.1 Information Subscribers provide</h3>
      <ul>
        <li>Account details: name, business email, phone, NMLS ID, and billing address.</li>
        <li>Billing information, processed directly by our payment processor, Stripe (see Section 5).</li>
        <li>Territory selections, plan tier, and platform configuration and usage data.</li>
      </ul>
      <h3>2.2 Information Visitors and Borrowers provide</h3>
      <ul>
        <li>ZIP code entered into the territory-availability checker.</li>
        <li>
          Contact and qualification details submitted through the AI intake assistant, the equity
          snapshot tool, demo requests, or a phone call routed through the platform &mdash; for
          example, name, phone number, email, property address, and general financing goals.
        </li>
        <li>Content of chat messages exchanged with the AI assistant.</li>
        <li>
          Call metadata (time, duration, routing outcome) and, where applicable and disclosed at
          the start of the call, call recordings, for the phone-intake feature.
        </li>
      </ul>
      <h3>2.3 Information collected automatically</h3>
      <p>
        On app.ypnus.com we use a single first-party, functional session cookie to keep you signed
        in. On ypnus.com we also use analytics tools &mdash; Google Analytics and Microsoft
        Clarity &mdash; to understand how visitors use the site and improve it. Clarity may record
        how you interact with pages (for example, clicks, scrolling, and navigation). These tools
        set cookies and receive device and usage information such as IP address, browser type, and
        pages viewed. We use them for analytics only, not for cross-context behavioral advertising,
        and we do not use third-party advertising cookies. If that changes, we will update this
        Policy and, where required by law, obtain your consent first.
      </p>

      <h2>3. How we use information</h2>
      <ul>
        <li>To operate the platform: authenticate Subscribers, enforce territory exclusivity, and process billing.</li>
        <li>To route a Borrower&rsquo;s inquiry to the Subscriber who holds that ZIP territory.</li>
        <li>To operate the AI intake assistant, qualify inquiries, and schedule appointments.</li>
        <li>To send transactional communications (account, billing, appointment, and support messages).</li>
        <li>To monitor, secure, and improve the platform, and to comply with legal obligations.</li>
      </ul>

      <h2>4. Automated and AI-assisted communications</h2>
      <p>
        Some Borrower-facing interactions (chat replies, qualification questions, and call
        handling) are generated or assisted by automated systems. Automated outputs may be
        inaccurate or incomplete and are not financial, legal, or credit advice. A Subscriber (a
        licensed human loan officer) is responsible for any credit-related communication sent to a
        Borrower and for reviewing automated content before it is relied upon.
      </p>
      <p>
        Chat conversations and phone calls with our AI assistants are processed by our AI service
        provider (currently Anthropic) to generate responses, and transcripts are stored so we can
        route your inquiry, respond, and maintain service quality. By using the chat or phone
        assistant, you consent to this recording and processing. Please do not share sensitive
        information such as Social Security, driver&rsquo;s license, or financial account numbers.
      </p>

      <h2>5. How we share information</h2>
      <ul>
        <li>
          <strong>With a participating loan officer Subscriber</strong> &mdash; a Borrower&rsquo;s
          inquiry is shared with a Subscriber on the platform so they can follow up, which is the
          core purpose of the platform. Assignment is based on the loan program involved and
          current workload among active Subscribers; it is not guaranteed to be limited to
          whichever Subscriber currently holds the ZIP-code territory associated with the
          inquiry.
        </li>
        <li>
          <strong>Stripe</strong> &mdash; processes Subscriber payments. We do not store full
          payment card numbers.
        </li>
        <li>
          <strong>Twilio</strong> &mdash; provides the telephony infrastructure for the AI
          phone-intake feature.
        </li>
        <li>
          <strong>ypnus.com (WordPress)</strong> &mdash; our coordinated marketing site, used for
          Subscriber sign-up, account provisioning, and single sign-on between ypnus.com and this
          platform.
        </li>
        <li>
          <strong>Anthropic</strong> &mdash; provides the AI models that generate assistant replies.
        </li>
        <li>
          <strong>Google Analytics and Microsoft Clarity</strong> &mdash; analytics on ypnus.com (see
          Section 2.3).
        </li>
        <li>Hosting, infrastructure, email, and other service providers who process data on our behalf under contract.</li>
        <li>Regulators, law enforcement, or other parties when required by law, subpoena, or to protect rights, safety, or property.</li>
        <li>A successor entity in connection with a merger, acquisition, or sale of assets.</li>
      </ul>
      <p id="do-not-sell-or-share">
        We do not sell personal information or share it for cross-context behavioral advertising,
        as those terms are defined under the California Consumer Privacy Act, and we have not done
        so in the past 12 months. We do not knowingly sell or share the personal information of
        consumers under 16.
      </p>

      <h2>6. Financial privacy (Gramm-Leach-Bliley Act)</h2>
      <p>
        Because this platform supports licensed mortgage professionals, certain information we
        collect may be considered nonpublic personal information under the Gramm-Leach-Bliley Act.
        We limit our collection and disclosure of such information to what is described in this
        Policy, do not disclose it to unaffiliated third parties for their own marketing purposes,
        and maintain administrative, technical, and physical safeguards designed to protect it. If
        you proceed to a loan application with a Subscriber&rsquo;s sponsoring lender, that lender
        will separately provide its own required privacy notices for the loan transaction itself.
      </p>

      <h2>7. Your privacy rights</h2>
      <p>
        Depending on where you live, you may have rights to know what personal information we hold
        about you, request a copy of it, request correction or deletion, and opt out of certain
        uses (for example, under the California Consumer Privacy Act, as amended by the California
        Privacy Rights Act, and similar laws in other states). To exercise a privacy right, contact
        us using the details in Section 12. We will verify your request and respond within the
        time required by applicable law. We will not discriminate against you for exercising these
        rights.
      </p>
      <h3>7.1 California residents</h3>
      <ul>
        <li>
          <strong>Your rights:</strong> to know the categories and specific pieces of personal
          information we collect, use, and disclose; to delete it; to correct inaccurate
          information; to opt out of any sale or sharing; and to limit the use of sensitive
          personal information. We respond within 45 days, as allowed by law. An authorized agent
          may submit a request on your behalf with your written permission.
        </li>
        <li>
          <strong>Categories and sources:</strong> the identifiers, commercial and professional
          information, internet activity, and inferences described in Section 2, collected from
          you, your devices, and the Subscriber you contact, for the purposes in Section 3 and
          disclosed to the recipients in Section 5.
        </li>
        <li>
          <strong>Sensitive personal information:</strong> we do not use or disclose sensitive
          personal information for purposes that would require offering a right to limit.
        </li>
        <li id="gpc">
          <strong>Global Privacy Control:</strong> we treat a Global Privacy Control (GPC) signal
          from your browser as a valid request to opt out of the sale or sharing of personal
          information for that browser.
        </li>
        <li>
          <strong>Do Not Track:</strong> because there is no common standard for browser
          &ldquo;Do Not Track&rdquo; signals, we do not respond to them other than honoring GPC as
          described above.
        </li>
        <li>
          <strong>Shine the Light:</strong> we do not disclose personal information to third
          parties for their own direct marketing purposes.
        </li>
        <li>
          <strong>How to submit a request:</strong> email{" "}
          <a href="mailto:support@ypnus.com">support@ypnus.com</a> or call{" "}
          <a href="tel:+15595120372">(559) 512-0372</a>. We will ask for information to verify your
          identity before acting on the request.
        </li>
      </ul>

      <h2>8. Communications preferences</h2>
      <p>
        By submitting your phone number or email through an intake form, chat, or call, you
        consent to be contacted by or on behalf of the relevant Subscriber about your inquiry,
        including by phone, text message, and email, which may use automated dialing or messaging
        technology. Message and data rates may apply. Reply <strong>STOP</strong> to opt out of
        text messages, or tell us directly using the contact details in Section 12 to opt out of
        any channel. Consent to be contacted is not a condition of obtaining any product or
        service.
      </p>

      <h2>9. Data retention and security</h2>
      <p>
        We retain information for as long as needed to operate the platform, provide the requested
        service, and meet legal, accounting, or regulatory requirements, after which it is deleted
        or de-identified. We use reasonable administrative, technical, and physical safeguards
        designed to protect information; no method of transmission or storage is 100% secure.
      </p>

      <h2>10. Children&rsquo;s privacy</h2>
      <p>
        This platform is directed at licensed mortgage professionals and adult consumers seeking
        mortgage information. It is not directed to, and we do not knowingly collect personal
        information from, children under 13 (or under 16 where a higher age applies under
        applicable law).
      </p>

      <h2>11. Changes to this Policy</h2>
      <p>
        We may update this Policy from time to time. The &ldquo;Last updated&rdquo; date above
        reflects the most recent revision. Material changes will be posted on this page.
      </p>

      <h2>12. Contact us</h2>
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
