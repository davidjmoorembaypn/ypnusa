import { blogImageFor } from "@/lib/blog-images";

/**
 * 16:9 thumbnail of a post's header photo for post lists. Decorative (empty alt): the post
 * title right beside it already names the link, so screen readers don't hear it twice.
 */
export function PostThumb({ slug, eager = false, className = "" }: { slug: string; eager?: boolean; className?: string }) {
  const photo = blogImageFor(slug);
  if (!photo) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.thumb}
      width={480}
      height={270}
      alt=""
      loading={eager ? undefined : "lazy"}
      decoding="async"
      className={`aspect-[16/9] w-full rounded-2xl bg-slate-100 object-cover ${className}`}
    />
  );
}
