import targets from "@/content/august-batch-redirects.json";

/**
 * The 74 templated posts dated 2026-08-07, each folded into its closest strong post.
 *
 * Why: these posts were published in one batch, run ~2,500 words each (2,469-2,551) and use
 * templated titles ("How High-Volume MLOs ...", "Automating MLO ...", "Building ... for MLOs").
 * Search Console reports about 128 URLs as "Discovered - currently not indexed" while the target
 * queries ("mortgage leads", "mlo leads", "loan officer marketing") sit at positions 80-99.
 * Each one overlaps a stronger post on the same topic, so it redirects there instead of
 * competing with it.
 *
 * How: august-batch-redirects.json maps each slug to its target post. next.config.ts turns the
 * map into 308 redirects from /blog/<slug> to /blog/<target>. INDEXABLE_POSTS
 * (src/lib/seo/clusters.ts) leaves these slugs out, so the sitemap, the blog index, the topic
 * pillars and related-post lists never list a URL that redirects.
 *
 * Only this batch is affected. Other posts, the answer-first posts and every page under
 * /self-employed-mortgage, /mortgage-loans, /research and /markets are untouched.
 * Targets must be indexable posts that are not themselves in the map (no chains);
 * august-batch-consolidation.test.ts enforces that.
 *
 * Reverse: delete a slug from august-batch-redirects.json and ship.
 */
export const CONSOLIDATED_POST_TARGETS: Readonly<Record<string, string>> = targets;

export const CONSOLIDATED_POST_SLUGS: ReadonlySet<string> = new Set(Object.keys(targets));
