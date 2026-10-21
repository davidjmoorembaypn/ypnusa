import { WP_TOP_PAGES } from "@/content/wp-import";
import { makeWpSectionRoute } from "@/lib/wp-page-route";

// Catch-all for the ~79 top-level WordPress pages that don't collide with an
// existing native route (Next.js resolves a static folder like /about or
// /pricing before falling through to this dynamic segment, so this never
// shadows anything already in src/app/). Unknown slugs 404 via notFound()
// inside makeWpSectionRoute, same as any other missing page.
const route = makeWpSectionRoute(WP_TOP_PAGES, "", "YPN USA");

export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
