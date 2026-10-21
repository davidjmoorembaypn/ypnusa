import { WP_MLO_MARKETING_PAGES } from "@/content/wp-import";
import { makeWpSectionRoute } from "@/lib/wp-page-route";

const route = makeWpSectionRoute(WP_MLO_MARKETING_PAGES, "/mlo-marketing", "MLO Marketing");

export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
