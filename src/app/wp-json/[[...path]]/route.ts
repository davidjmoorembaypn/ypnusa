import { goneResponse } from "@/lib/gone";

// Retired WordPress path: answer 410 Gone to every method. See src/lib/gone.ts.

export const GET = goneResponse;
export const HEAD = goneResponse;
export const POST = goneResponse;
export const PUT = goneResponse;
export const PATCH = goneResponse;
export const DELETE = goneResponse;
export const OPTIONS = goneResponse;
