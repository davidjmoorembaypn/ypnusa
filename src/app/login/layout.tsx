import type { ReactNode } from "react";

/**
 * The sign-in pages are written dark-on-light. The site's default background turns near-black
 * when a visitor's device is in dark mode, which left dark text on a black page. This gives the
 * pages their own light background and tells the browser to draw form controls light as well.
 */
export default function LoginLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen flex-1 bg-white text-slate-900 [color-scheme:light]">{children}</div>;
}
