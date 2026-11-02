"use client";
import Script from "next/script";
import { usePathname } from "next/navigation";

/** Sign-in URLs and fragments must never be sent to analytics. */
export function SiteAnalytics({ id }: { id?: string }) {
  const pathname = usePathname();
  if (!id || !/^G-[A-Z0-9]+$/.test(id) || pathname?.startsWith("/login")) return null;
  return <>
    <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
    <Script id="ga4-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}',{page_location:window.location.origin+window.location.pathname});`}</Script>
  </>;
}
