import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { jsonError, logApiError } from "@/lib/http";
import { listLiveChats } from "@/lib/live-chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/live-chats: the signed-in officer's borrower chats from the last 7 days. */
export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Sign in to see your live chats.", 401, "UNAUTHENTICATED");
  try {
    return NextResponse.json({ ok: true, chats: listLiveChats(session) });
  } catch (error) {
    logApiError("/api/live-chats", error);
    return jsonError("Couldn't load your chats.", 500, "LIVE_CHATS_FAILED");
  }
}
