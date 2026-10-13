"use client";

import { useEffect, useMemo, useState } from "react";

const assetOptions = [
  { value: "about", label: "About David J. Moore" },
  { value: "books", label: "Books & resources" },
  { value: "features", label: "Features hub" },
  { value: "zipwp", label: "ZipWP partner page" },
  { value: "pricing", label: "Pricing page" },
];

const audienceOptions = [
  { value: "mortgage-professionals", label: "Mortgage professionals" },
  { value: "real-estate-partners", label: "Real-estate partners" },
  { value: "local-business-directories", label: "Local business directories" },
  { value: "media-contacts", label: "Media & industry contacts" },
];

const templateMap = {
  about: {
    subject: "David J. Moore / YPN USA: a mortgage growth operator worth following",
    body: `Hi [Name],

I came across your work and wanted to share a resource that may be relevant to your audience.

David J. Moore is a mortgage growth operator and founder of YPN USA, helping loan officers build more controlled pipelines and stronger local marketing systems.

You can review the site here:
https://ypnus.com/about

This may be useful for an audience focused on mortgage growth, lead generation, and digital visibility.

Best,
[Your Name]`,
  },
  books: {
    subject: "Helpful mortgage marketing books and resources for your audience",
    body: `Hi [Name],

I wanted to share a resource that may be valuable to your readers:

YPN USA’s books and author resources:
https://ypnus.com/books

These are practical resources for mortgage professionals, real-estate marketers, and growth-minded operators.

Best,
[Your Name]`,
  },
  features: {
    subject: "Useful mortgage growth tools for loan officers and teams",
    body: `Hi [Name],

I thought your readers may appreciate a practical resource on mortgage growth systems:

YPN USA Features
https://ypnus.com/features

It includes tools for AI intake, local visibility, and ZIP-based lead ownership.

Best,
[Your Name]`,
  },
  zipwp: {
    subject: "Website builder partner for mortgage professionals",
    body: `Hi [Name],

I wanted to share a partner resource that may fit your audience:

ZipWP for mortgage professionals
https://ypnus.com/zipwp

This page focuses on website builders, digital presence, and conversion-focused design for mortgage professionals.

Best,
[Your Name]`,
  },
  pricing: {
    subject: "Mortgage growth pricing for modern loan officers",
    body: `Hi [Name],

I thought your readers might appreciate a clear breakdown of mortgage growth tools and pricing:

YPN USA Pricing
https://ypnus.com/pricing

It covers how loan officers can reserve a ZIP territory, deploy AI intake, and retain ownership of the lead pipeline.

Best,
[Your Name]`,
  },
} as const;

export default function BacklinkGeneratorPage() {
  const [asset, setAsset] = useState("about");
  const [audience, setAudience] = useState("mortgage-professionals");
  const [subject, setSubject] = useState(templateMap.about.subject);
  const [body, setBody] = useState(templateMap.about.body);

  const selectedAsset = useMemo(
    () => assetOptions.find((item) => item.value === asset) ?? assetOptions[0],
    [asset],
  );
  const selectedAudience = useMemo(
    () => audienceOptions.find((item) => item.value === audience) ?? audienceOptions[0],
    [audience],
  );

  useEffect(() => {
    const template = templateMap[asset as keyof typeof templateMap];
    setSubject(template.subject);
    setBody(template.body);
  }, [asset]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-16 text-slate-900">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">Tools</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
          Backlink outreach generator
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-700">
          Create outreach copy for link-building, partnership pitching, and local visibility campaigns.
        </p>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Asset</label>
              <select
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
              >
                {assetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Audience</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
              >
                {audienceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Subject</label>
              <textarea
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[220px] w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">How this page earns links</h3>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-slate-700">
              <li>Practical, educational value.</li>
              <li>Built for mortgage and real-estate professionals.</li>
              <li>Useful to local business and trade audiences.</li>
              <li>Strong authority and brand positioning.</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Suggested prospects</h3>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-slate-700">
              <li>Local chamber of commerce pages</li>
              <li>Mortgage broker association directories</li>
              <li>Partner blog owners in real-estate communities</li>
              <li>Local business and service directories</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Campaign notes</h3>
            <p className="text-sm leading-6 text-slate-700">
              Keep outreach conversational, useful, and specific. The best link-building in this niche is
              educational and helpful rather than aggressive or spammy.
            </p>
          </div>

          <div className="rounded-3xl border border-violet-200 bg-violet-50 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">Selected</p>
            <h3 className="mt-3 text-xl font-semibold text-slate-900">{selectedAsset.label}</h3>
            <p className="mt-2 text-sm text-slate-700">Audience: {selectedAudience.label}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
