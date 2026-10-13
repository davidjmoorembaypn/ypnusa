export type UtmCampaign =
  | "homepage"
  | "pricing"
  | "zipwp"
  | "about"
  | "book"
  | "resources"
  | "backlink-generator";

export function buildUtmUrl(
  url: string,
  params: {
    source: string;
    medium: string;
    campaign: UtmCampaign;
    content?: string;
  },
) {
  const base = typeof window !== "undefined" ? window.location.origin : "https://ypnus.com";
  const nextUrl = new URL(url, base);
  nextUrl.searchParams.set("utm_source", params.source);
  nextUrl.searchParams.set("utm_medium", params.medium);
  nextUrl.searchParams.set("utm_campaign", params.campaign);
  if (params.content) nextUrl.searchParams.set("utm_content", params.content);
  return nextUrl.toString();
}

export function trackCtaClick({
  source,
  medium,
  campaign,
  content,
  href,
}: {
  source: string;
  medium: string;
  campaign: UtmCampaign;
  content?: string;
  href: string;
}) {
  const finalUrl = buildUtmUrl(href, { source, medium, campaign, content });

  if (typeof window !== "undefined" && "dataLayer" in window) {
    const globalAny = window as typeof window & {
      dataLayer?: Array<Record<string, unknown>>;
    };
    globalAny.dataLayer = globalAny.dataLayer ?? [];
    globalAny.dataLayer.push({
      event: "cta_click",
      source,
      medium,
      campaign,
      content: content ?? "",
      href: finalUrl,
      timestamp: new Date().toISOString(),
    });
  }

  return finalUrl;
}
