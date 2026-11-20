import type { Metadata } from "next";
import { SelfEmployedHubPage } from "@/components/self-employed/self-employed-pages";
import { SELF_EMPLOYED_HUB, SELF_EMPLOYED_HUB_PATH } from "@/content/self-employed-loans";
import { marketingMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...marketingMetadata({
    title: SELF_EMPLOYED_HUB.metaTitle,
    description: SELF_EMPLOYED_HUB.description,
    path: SELF_EMPLOYED_HUB_PATH,
  }),
  robots: { index: true, follow: true },
};

export default function SelfEmployedMortgagePage() {
  return <SelfEmployedHubPage />;
}
