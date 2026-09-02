import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runAssistantTurn } from "@/lib/ai/chat-agent";
import { isRecord, jsonError, logApiError, parseJsonBody } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import type { AssistantMode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES = new Set<AssistantMode>(["public_site", "mlo_dashboard", "lead_qualification"]);
const MAX_MESSAGE_LENGTH = 4000;
const MAX_SESSION_ID_LENGTH = 160;

interface ChatRequestBody {
  mode: AssistantMode;
  message: string;
  sessionId?: string;
  funnelSource?: string;
}

function optionalString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function validateBody(
  data: unknown,
): { ok: true; body: ChatRequestBody } | { ok: false; error: string; code: string } {
  if (!isRecord(data)) {
    return { ok: false, error: "Request body must be a JSON object.", code: "INVALID_BODY" };
  }

  const mode = typeof data.mode === "string" ? (data.mode as AssistantMode) : undefined;
  if (!mode || !MODES.has(mode)) {
    return { ok: false, error: "mode must be one of public_site, mlo_dashboard, lead_qualification.", code: "INVALID_MODE" };
  }

  const message = optionalString(data.message, MAX_MESSAGE_LENGTH);
  if (!message) {
    return { ok: false, error: "message is required.", code: "MISSING_MESSAGE" };
  }

  return {
    ok: true,
    body: {
      mode,
      message,
      sessionId: optionalString(data.sessionId, MAX_SESSION_ID_LENGTH),
      funnelSource: optionalString(data.funnelSource, 160),
    },
  };
}

export async function POST(request: Request) {
  const limited = rateLimit(`assistant:${clientKey(request)}`, 30, 60_000);
  if (!limited.ok) {
    return jsonError("Too many assistant messages — please slow down and try again shortly.", 429, "RATE_LIMITED");
  }

  try {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code ?? "INVALID_JSON");

    const validated = validateBody(parsed.data);
    if (!validated.ok) return jsonError(validated.error, 400, validated.code);

    const { mode, message, sessionId, funnelSource } = validated.body;

    let userId: string | undefined;
    if (mode === "mlo_dashboard") {
      const session = await getSession();
      if (!session) return jsonError("Sign in to use the dashboard assistant.", 401, "UNAUTHENTICATED");
      userId = session.sub;
    }

    const result = await runAssistantTurn({
      mode,
      sessionId,
      userId,
      funnelSource,
      userMessage: message,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logApiError("/api/assistant/chat", error);
    return jsonError("The assistant is temporarily unavailable. Please try again.", 500, "ASSISTANT_FAILED");
  }
}
