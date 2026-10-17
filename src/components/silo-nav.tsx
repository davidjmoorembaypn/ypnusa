import Link from "next/link";
import { SILOS, type SiloId } from "@/lib/silos";

/**
 * "More in this section" link block: pillar first, then the page's siblings grouped by type. The
 * current page is omitted. Plain server-rendered anchors, so crawlers see the cluster in the HTML.
 */
export function SiloNav({
  silo,
  currentPath,
  tone = "dark",
  className = "",
}: {
  silo: SiloId;
  currentPath: string;
  tone?: "dark" | "light";
  className?: string;
}) {
  const def = SILOS[silo];
  const groups = new Map<string, { label: string; href: string }[]>();
  for (const link of def.links()) {
    if (link.href === currentPath) continue;
    groups.set(link.group, [...(groups.get(link.group) ?? []), link]);
  }
  const dark = tone === "dark";

  return (
    <nav
      aria-label={`More in ${def.name}`}
      className={`rounded-3xl border p-6 ${dark ? "border-white/10 bg-white/5 text-white" : "border-slate-200 bg-white text-slate-900"} ${className}`}
    >
      <h2 className="text-lg font-semibold">More in {def.name}</h2>
      {currentPath !== def.pillar.href ? (
        <p className="mt-2 text-sm">
          <Link href={def.pillar.href} className={`font-semibold underline ${dark ? "text-violet-200 hover:text-white" : "text-violet-700 hover:text-violet-900"}`}>
            {def.pillar.label}
          </Link>
        </p>
      ) : null}
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        {[...groups.entries()].map(([group, links]) => (
          <div key={group}>
            <h3 className={`text-xs font-semibold uppercase tracking-wide ${dark ? "text-white/50" : "text-slate-500"}`}>{group}</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={`underline-offset-2 hover:underline ${dark ? "text-violet-200" : "text-violet-700"}`}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
