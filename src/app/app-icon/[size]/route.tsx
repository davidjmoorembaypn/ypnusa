import { appIcon } from "@/lib/pwa/app-icon";

/** Square app icons for the web app manifest (192 and 512 px). Built once at build time. */
export const dynamic = "force-static";
export const dynamicParams = false;

const SIZES = [192, 512] as const;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}

export async function GET(_request: Request, context: { params: Promise<{ size: string }> }) {
  const { size: raw } = await context.params;
  const size = SIZES.find((item) => String(item) === raw) ?? 192;
  return appIcon(size);
}
