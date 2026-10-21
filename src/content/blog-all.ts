import { BLOG_POSTS, type BlogPost } from "@/content/blog";
import { WP_POSTS } from "@/content/wp-import";

/**
 * Native hand-written posts plus the ~171 canonical posts migrated from
 * ypnus.com's WordPress (see src/content/wp-import/index.ts). Slugs don't
 * collide between the two sources (checked at build time by the export
 * script); if that ever changes, the native post wins.
 */
export const ALL_BLOG_POSTS: readonly BlogPost[] = [
  ...BLOG_POSTS,
  ...WP_POSTS.filter((wp) => !BLOG_POSTS.some((native) => native.slug === wp.slug)),
];

export function getAnyBlogPost(slug: string): BlogPost | undefined {
  return ALL_BLOG_POSTS.find((post) => post.slug === slug);
}
