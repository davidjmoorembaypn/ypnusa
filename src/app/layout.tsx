import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import { APP_SITE_URL, MARKETING_SITE_URL, centralValleyAreaServed } from "@/lib/site";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const revalidate = 300;

export const metadata: Metadata = {
  metadataBase: new URL(APP_SITE_URL),
  title: {
    default: "YPN USA App — Mortgage Growth Platform for Loan Officers",
    template: "%s · YPN USA App",
  },
  description:
    "YPN USA is the mortgage growth platform for loan officers: claim exclusive ZIP territories, capture borrowers with AI intake, and turn local demand into owned leads.",
  applicationName: "YPN USA App",
  authors: [{ name: "David J. Moore, MBA" }],
  creator: "YPN Inc.",
  publisher: "YPN Inc.",
  category: "Business",
  referrer: "origin-when-cross-origin",
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
    url: APP_SITE_URL,
    siteName: "YPN USA App",
    title: "YPN USA App — Mortgage Growth Platform for Loan Officers",
    description:
      "Claim exclusive ZIP territories, capture borrowers with AI intake, and build an owned mortgage lead pipeline.",
  },
  twitter: {
    card: "summary_large_image",
    title: "YPN USA App — Mortgage Growth Platform for Loan Officers",
    description:
      "Exclusive ZIP territories and AI borrower intake for mortgage loan officers.",
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
      founder: { "@id": `${MARKETING_SITE_URL}/#person-david-moore` },
      sameAs: [
        "https://www.linkedin.com/in/davidjmooreypn",
        "https://www.facebook.com/YPN.Incorporated/",
      ],
    },
    {
      "@type": "Person",
      "@id": `${MARKETING_SITE_URL}/#person-david-moore`,
      name: "David J. Moore, MBA",
      jobTitle: "CEO & Founder",
      worksFor: [
        { "@id": `${MARKETING_SITE_URL}/#organization` },
        { "@type": "Organization", name: "ToInvested.com" },
      ],
      alumniOf: {
        "@type": "CollegeOrUniversity",
        name: "California State University, Fresno",
      },
      hasCredential: {
        "@type": "EducationalOccupationalCredential",
        credentialCategory: "MBA",
      },
      description:
        "Former top-producing mortgage professional with thousands of closed home loans at Chase Bank and Wells Fargo Home Mortgage. Published Amazon real estate author and nationwide speaker.",
      sameAs: [
        "https://orcid.org/0009-0008-8069-8897",
        "https://www.linkedin.com/in/davidjmoorembaypninc/",
        "https://www.facebook.com/DavidjMooreMBA/about/",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${MARKETING_SITE_URL}/#website`,
      name: "YPN USA",
      url: MARKETING_SITE_URL,
      publisher: { "@id": `${MARKETING_SITE_URL}/#organization` },
    },
    {
      "@type": "WebApplication",
      "@id": `${APP_SITE_URL}/#app`,
      name: "YPN USA App",
      url: APP_SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      isPartOf: { "@id": `${MARKETING_SITE_URL}/#organization` },
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        { "@type": "Offer", name: "Growth", price: "99.99", priceCurrency: "USD" },
        { "@type": "Offer", name: "Pro", price: "199.99", priceCurrency: "USD" },
        { "@type": "Offer", name: "Elite", price: "299.99", priceCurrency: "USD" },
      ],
      description:
        "Mortgage growth platform for licensed loan officers with exclusive ZIP territories, AI borrower intake, qualification, and nurture.",
    },
  ],
};

const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim();

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {GA_ID ? (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        ) : null}

        <header className="border-b bg-white/60 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
            <Link href="/" className="text-xl font-bold text-slate-900">
              YPN USA
            </Link>
            <nav className="hidden gap-4 md:flex">
              <Link href="/features" className="text-sm font-medium text-slate-700 hover:text-slate-900">
                Features
              </Link>
              <Link href="/pricing" className="text-sm font-medium text-slate-700 hover:text-slate-900">
                Pricing
              </Link>
              <Link href="/zipwp" className="text-sm font-medium text-slate-700 hover:text-slate-900">
                ZipWP
              </Link>
              <Link href="/about" className="text-sm font-medium text-slate-700 hover:text-slate-900">
                About
              </Link>
            </nav>
            <div className="flex items-center gap-3">
              <Link href="/login" className="rounded-md border px-3 py-2 text-sm font-medium">
                Sign in
              </Link>
              <Link href="/pricing" className="rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white">
                Start free
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t bg-slate-50">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <h3 className="text-sm font-semibold">YPN Inc.</h3>
                <p className="mt-2 text-sm text-slate-700">Four Embarcadero Center, Suite 1400, San Francisco, CA 94111</p>
                <p className="mt-1 text-sm text-slate-700">Phone: +1 559-607-3797</p>
                <p className="mt-2 text-sm">
                  <Link href="/about" className="text-violet-700 underline">
                    About the founder
                  </Link>
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Resources</h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  <li>
                    <Link href="/features" className="hover:underline">
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link href="/zipwp" className="hover:underline">
                      ZipWP (affiliate)
                    </Link>
                  </li>
                  <li>
                    <Link href="/pricing" className="hover:underline">
                      Pricing
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Trust & books</h3>
                <p className="mt-2 text-sm text-slate-700">Published author — books available on Amazon.</p>
                <div className="mt-3 flex gap-3">
                  <img src="/images/book1.svg" alt="Book cover" className="h-12 w-8 rounded-md" />
                  <img src="/images/book2.svg" alt="Book cover" className="h-12 w-8 rounded-md" />
                </div>
              </div>
            </div>

            <div className="mt-8 text-center text-xs text-slate-500">
              © {new Date().getFullYear()} YPN Inc. — All rights reserved. <br />
              <Link href="/privacy-policy">Privacy</Link> · <Link href="/terms-of-service">Terms</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
