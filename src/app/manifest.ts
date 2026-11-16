import type { MetadataRoute } from "next";
import { APP_THEME_COLOR } from "@/lib/pwa/theme";

/**
 * Web app manifest: lets a loan officer add the dashboard to their phone's home screen
 * and open it full screen like an app. Opens on /dashboard (sign-in redirects there).
 * Icons come from /app-icon/[size] (generated, no image files to maintain).
 */

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: "YPN USA",
    short_name: "YPN USA",
    description: "Your YPN USA dashboard: Cerebro, new borrower leads and follow-ups.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: APP_THEME_COLOR,
    theme_color: APP_THEME_COLOR,
    categories: ["business", "productivity", "finance"],
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
