import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { readChatSession } from "@/lib/db";
import { isRecord, jsonError, logApiError, parseJsonBody } from "@/lib/http";
import {
  canManageChat,
  handBackChat,
  officerReply,
  takeOverChat,
  transcriptMessages,
  type TakeoverResult,
} from "@/lib/live-chat";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import type { ChatSessionRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ sessionId: string }> };

function chatView(session: ChatSessionRecord) {
  return {
    sessionId: session.id,
    handledBy: session.handledBy ?? "ai",
    status: session.status,
    updatedAt: session.updatedAt,
    borrowerName: session.capturedFields.name ?? null,
    messages: transcriptMessages(session),
  };
}

/** GET: one borrower chat (transcript and who is answering), for the officer it belongs to. */
export async function GET(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return jsonError("Sign in to see this chat.", 401, "UNAUTHENTICATED");
  const { sessionId } = await params;
  const chat = readChatSession(sessionId);
  // Same answer for "missing" and "someone else's", so ids can't be probed.
  if (!chat || !canManageChat(chat, session)) return jsonError("Chat not found.", 404, "NOT_FOUND");
  return NextResponse.json({ ok: true, chat: chatView(chat) });
}

/**
 * POST { action: "take_over" | "hand_back" | "reply", message? }
 * take_over pauses Cerebro on this chat, reply sends the officer's own message (only while
 * taken over), hand_back lets Cerebro answer again.
 */
export async function POST(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return jsonError("Sign in to answer this chat.", 401, "UNAUTHENTICATED");
  const limited = rateLimit(`live-chat:${session.sub}:${clientKey(request)}`, 60, 60_000);
  if (!limited.ok) return jsonError("Too many actions. Wait a moment and try again.", 429, "RATE_LIMITED");

  try {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code ?? "INVALID_JSON");
    if (!isRecord(parsed.data)) return jsonError("Request body must be a JSON object.", 400, "INVALID_BODY");
    const { action, message } = parsed.data;
    const { sessionId } = await params;

    let result: TakeoverResult;
    if (action === "take_over") result = takeOverChat(sessionId, session);
    else if (action === "hand_back") result = handBackChat(sessionId, session);
    else if (action === "reply") result = officerReply(sessionId, session, message);
    else return jsonError("action must be take_over, hand_back or reply.", 400, "INVALID_ACTION");

    if (!result.ok) {
      switch (result.code) {
        case "NOT_FOUND":
        case "FORBIDDEN":
          return jsonError("Chat not found.", 404, "NOT_FOUND");
        case "NOT_TAKEN_OVER":
          return jsonError("Take over the chat before replying.", 409, "NOT_TAKEN_OVER");
        case "EMPTY_MESSAGE":
          return jsonError("Type a message first.", 400, "EMPTY_MESSAGE");
      }
    }
    return NextResponse.json({ ok: true, chat: chatView(result.session) });
  } catch (error) {
    logApiError("/api/live-chats/[sessionId]", error);
    return jsonError("Couldn't update the chat. Try again.", 500, "LIVE_CHAT_FAILED");
  }
}
