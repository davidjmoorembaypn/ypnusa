import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { generateMarketingTool, parseMarketingToolInput } from "@/lib/marketing-tools";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, {
    scope: "marketing-tools",
    limit: 8,
    windowMs: 60_000,
    message: "Too many generations. Please wait a minute and try again.",
  });
  if (limited) return limited;

  try {
    const input = parseMarketingToolInput(await request.json());
    const output = await generateMarketingTool(input);
    return NextResponse.json({ ok: true, tool: input.tool, output });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate right now.";
    if (message === "AI_PROVIDER_NOT_CONFIGURED") {
      return NextResponse.json({ ok: false, error: "AI generation is temporarily unavailable." }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
