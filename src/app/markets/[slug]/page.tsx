import { WP_MARKET_PAGES } from "@/content/wp-import";
import { makeWpSectionRoute } from "@/lib/wp-page-route";

const route = makeWpSectionRoute(WP_MARKET_PAGES, "/markets", "Markets");

export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
