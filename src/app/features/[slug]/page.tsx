import { WP_FEATURES_SUBPAGES } from "@/content/wp-import";
import { makeWpSectionRoute } from "@/lib/wp-page-route";

// The root /features page is this app's own hand-built page (src/app/features/page.tsx)
// and is untouched by the WordPress migration. These are the 6 /features/* subpages
// WordPress had (Analytics Dashboard, Hyper-Local SEO Pages, etc.) — WordPress's own
// root /features content was dropped in favor of the native page (see
// src/content/wp-import/index.ts).
const route = makeWpSectionRoute(WP_FEATURES_SUBPAGES, "/features", "Features");

export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
