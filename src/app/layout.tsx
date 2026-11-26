import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import { MARKETING_SITE_URL } from "@/lib/site";
import { businessEntityJsonLd } from "@/lib/business-profile";
import { FOUNDER_ID } from "@/lib/seo";
import "./globals.css";
import { FunnelPageEvents } from "@/components/analytics/funnel-page-events";
import { ClarityTag } from "@/components/analytics/clarity-tag";
import { normalizeClarityId } from "@/lib/clarity";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

// Hostinger's CDN honors s-maxage and never purges on deploy; Next's default for a
// static page is a year. ISR every 5 minutes (plus expireTime in next.config.ts)
// caps edge staleness at ~10 minutes. Dynamic pages stay private/no-store.
export const revalidate = 300;

export const metadata: Metadata = {
  // app.ypnus.com 301s to ypnus.com, so relative metadata URLs resolve on the canonical host.
  metadataBase: new URL(MARKETING_SITE_URL),
  title: {
    default: "YPN USA App — Mortgage Growth Platform for Loan Officers",
    template: "%s | YPN USA",
  },
  description:
    "The mortgage growth platform for loan officers: claim an exclusive ZIP code, capture borrowers with Cerebro AI intake, and turn local demand into leads.",
  applicationName: "YPN USA App",
  authors: [{ name: "David J. Moore, MBA" }],
  creator: "YPN USA",
  publisher: "YPN USA",
  category: "Business",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "YPN USA",
    title: "YPN USA App — Mortgage Growth Platform for Loan Officers",
    description:
      "Claim exclusive ZIP code territories, capture borrowers with AI intake, and build an owned mortgage lead pipeline.",
  },
  twitter: {
    card: "summary_large_image",
    title: "YPN USA App — Mortgage Growth Platform for Loan Officers",
    description:
      "Exclusive ZIP code territories and AI borrower intake for mortgage loan officers.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    businessEntityJsonLd({ "@id": FOUNDER_ID, name: "David J. Moore, MBA" }),
    {
      "@type": "WebSite",
      "@id": `${MARKETING_SITE_URL}/#website`,
      name: "YPN USA",
      url: MARKETING_SITE_URL,
      inLanguage: "en-US",
      publisher: { "@id": `${MARKETING_SITE_URL}/#organization` },
    },
  ],
};

// GA4 stays off until NEXT_PUBLIC_GA_ID is set AND the host CSP allows googletagmanager.com / google-analytics.com.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim();
// Microsoft Clarity stays off until NEXT_PUBLIC_CLARITY_ID is set at build time (public project ID, not a secret).
const CLARITY_ID = normalizeClarityId(process.env.NEXT_PUBLIC_CLARITY_ID);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {GA_ID ? (
          <>
            {/* The gtag() queue below is defined early, so events fired before the library arrives
                wait in the page and send once it loads. The ~150 KB library itself loads after the
                page has finished loading, so it no longer competes with the hero image on a phone.
                Accepted trade-off: a visitor who leaves before then sends none of the queued events. */}
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="lazyOnload" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        ) : null}
        <FunnelPageEvents />
        {CLARITY_ID ? <ClarityTag projectId={CLARITY_ID} /> : null}
        {children}
      </body>
    </html>
  );
}
