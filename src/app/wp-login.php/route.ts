import { goneResponse } from "@/lib/gone";

// Retired WordPress login: answer 410 Gone to every method. See src/lib/gone.ts.
// Apache no longer proxies /wp-login.php to the old WordPress origin
// (aws/apache/zz-ypnus-com.conf.tmpl), so the request reaches this route.

export const GET = goneResponse;
export const HEAD = goneResponse;
export const POST = goneResponse;
export const PUT = goneResponse;
export const PATCH = goneResponse;
export const DELETE = goneResponse;
export const OPTIONS = goneResponse;
