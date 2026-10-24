import { WP_LOAN_TYPE_PAGES } from "@/content/wp-import";
import { makeWpSectionRoute } from "@/lib/wp-page-route";

const route = makeWpSectionRoute(WP_LOAN_TYPE_PAGES, "/loan-types", "Loan Types");

export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
