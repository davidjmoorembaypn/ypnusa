import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import { MARKETING_SITE_URL, centralValleyAreaServed } from "@/lib/site";
import { FOUNDER_ID } from "@/lib/seo";
import "./globals.css";
import { FunnelPageEvents } from "@/components/analytics/funnel-page-events";

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
  creator: "YPN Inc.",
  publisher: "YPN Inc.",
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
    siteName: "YPN USA App",
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
    {
      "@type": ["Organization", "ProfessionalService"],
      "@id": `${MARKETING_SITE_URL}/#organization`,
      name: "YPN USA",
      legalName: "YPN INC",
      url: MARKETING_SITE_URL,
      email: "support@ypnus.com",
      telephone: "+15595120372",
      address: {
        "@type": "PostalAddress",
        streetAddress: "247 N L Street",
        addressLocality: "Dinuba",
        addressRegion: "CA",
        postalCode: "93618",
        addressCountry: "US",
      },
      areaServed: centralValleyAreaServed(),
      // Full Person node (credentials) lives on /about and in post author boxes.
      founder: { "@type": "Person", "@id": FOUNDER_ID, name: "David J. Moore, MBA" },
      sameAs: [
        "https://www.linkedin.com/in/davidjmooreypn",
        "https://www.facebook.com/YPN.Incorporated/",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${MARKETING_SITE_URL}/#website`,
      name: "YPN USA",
      url: MARKETING_SITE_URL,
      publisher: { "@id": `${MARKETING_SITE_URL}/#organization` },
    },
  ],
};

// GA4 stays off until NEXT_PUBLIC_GA_ID is set AND the host CSP allows googletagmanager.com / google-analytics.com.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim();

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
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        ) : null}
        <FunnelPageEvents />
        {children}
      </body>
    </html>
  );
}
