import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/legal-page-layout";

export const metadata: Metadata = {
  title: "Accessibility Statement",
  description: "YPN Inc.'s commitment to digital accessibility on app.ypnus.com.",
};

const LAST_UPDATED = "September 13, 2026";

export default function AccessibilityStatementPage() {
  return (
    <LegalPageLayout
      title="Accessibility Statement"
      lastUpdated={LAST_UPDATED}
      intro="YPN Inc. is committed to making app.ypnus.com usable by everyone, including people with disabilities."
    >
      <h2>Our commitment</h2>
      <p>
        We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1, Level AA, for
        the pages and tools we control on this platform. This includes attention to keyboard
        navigation, readable color contrast, descriptive labels for interactive controls, and
        touch targets sized for mobile use.
      </p>

      <h2>Ongoing work</h2>
      <p>
        Accessibility is an ongoing effort. As we add or change features &mdash; including the AI
        intake assistant, territory tools, and borrower-facing forms &mdash; we review them against
        these guidelines and correct issues we identify.
      </p>

      <h2>Third-party and linked content</h2>
      <p>
        Some content is served from or links to third-party services (for example, ypnus.com,
        Stripe checkout, or embedded maps) that we do not fully control. We encourage those
        providers to meet the same standard but cannot guarantee their accessibility.
      </p>

      <h2>Let us know</h2>
      <p>
        If you use assistive technology and encounter a barrier on this platform, or need
        information in an alternate format, please contact us and we will work with you to provide
        the information or service you need:
      </p>
      <p>
        Email: <a href="mailto:support@ypnus.com">support@ypnus.com</a>
        <br />
        Phone: <a href="tel:+15595120372">(559) 512-0372</a>
      </p>
    </LegalPageLayout>
  );
}
