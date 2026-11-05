import { WP_AGENT_PAGES } from "@/content/wp-import";
import { makeWpSectionRoute } from "@/lib/wp-page-route";

// Loan officer profile pages migrated from ypnus.com (e.g. /agents/david-j-moore-mba).
const route = makeWpSectionRoute(WP_AGENT_PAGES, "/agents", "Loan officers");

export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
