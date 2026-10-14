export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-300">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-balance text-3xl font-semibold tracking-tight text-white lg:text-4xl">
        {title}
      </h2>
      {description ? <p className="mt-4 text-pretty leading-relaxed text-slate-300">{description}</p> : null}
    </div>
  );
}
