/**
 * 410 Gone for retired WordPress paths (/wp-json/*, /wp-admin/*, /wp-login.php).
 *
 * WordPress is retired and these addresses will never come back, so bots get a permanent-removal
 * signal instead of a 404 they would keep retrying. next.config redirects and rewrites cannot set
 * a 410 status, which is why these are route handlers. /wp-content/uploads is NOT covered: the
 * app still serves migrated images from there.
 */
export function goneResponse(): Response {
  return new Response("410 Gone. This WordPress address has been permanently removed.\n", {
    status: 410,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "X-Robots-Tag": "noindex",
    },
  });
}
