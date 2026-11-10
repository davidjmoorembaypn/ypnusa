import { BLOG_POSTS, type BlogPost } from "@/content/blog";
import { PLAN_POSTS } from "@/content/blog-plan-2026-11";
import { WP_POSTS } from "@/content/wp-import";

/**
 * Native hand-written posts plus the ~171 canonical posts migrated from
 * ypnus.com's WordPress (see src/content/wp-import/index.ts). Slugs don't
 * collide between the two sources (checked at build time by the export
 * script); if that ever changes, the native post wins.
 */
const NATIVE_POSTS: readonly BlogPost[] = [...PLAN_POSTS, ...BLOG_POSTS];

export const ALL_BLOG_POSTS: readonly BlogPost[] = [
  ...NATIVE_POSTS,
  ...WP_POSTS.filter((wp) => !NATIVE_POSTS.some((native) => native.slug === wp.slug)),
];

export function getAnyBlogPost(slug: string): BlogPost | undefined {
  return ALL_BLOG_POSTS.find((post) => post.slug === slug);
}
