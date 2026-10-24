import { WP_VS_PAGES } from "@/content/wp-import";
import { makeWpSectionRoute } from "@/lib/wp-page-route";

const route = makeWpSectionRoute(WP_VS_PAGES, "/vs", "Compare");

export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
