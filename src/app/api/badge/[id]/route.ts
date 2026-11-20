import { recordBadgeSeen } from "@/lib/db";
import { badgeHostFromReferer, badgeSvg } from "@/lib/marketing-kit";
import { findOnboardingByShortId, publicOfficerPageFor, shortIdFromSlug } from "@/lib/officer-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  // Short cache: a new ZIP code or name shows up within the hour, and the Referer check
  // still sees a request now and then from each website.
  "Cache-Control": "public, max-age=3600",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

/**
 * The "Powered by YPN USA" badge image for a loan officer's own website, addressed by their
 * short id. Shows their name, NMLS ID and locked ZIP code. An unknown id gets the plain
 * Cerebro badge, never an error, so a pasted snippet never shows a broken image.
 *
 * When the request comes from an outside website, that website is noted on the officer's
 * marketing kit (once a day at most): it's how the dashboard knows the badge is up.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shortId = shortIdFromSlug(id);
  const record = shortId ? findOnboardingByShortId(shortId) : null;
  const profile = record?.officerProfile ?? null;
  const page = publicOfficerPageFor(record);

  if (record) {
    const host = badgeHostFromReferer(request.headers.get("referer"));
    if (host) {
      try {
        recordBadgeSeen(record.userId, host);
      } catch (error) {
        console.error("[badge] Unable to record badge sighting", error);
      }
    }
  }

  return new Response(badgeSvg({ profile, zip: page?.zips[0] }), { status: 200, headers: HEADERS });
}
