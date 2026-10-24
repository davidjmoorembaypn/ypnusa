import { WP_TERRITORY_PAGES } from "@/content/wp-import";
import { makeWpSectionRoute } from "@/lib/wp-page-route";

const route = makeWpSectionRoute(WP_TERRITORY_PAGES, "/territory", "Territory");

export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
