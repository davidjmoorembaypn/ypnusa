import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { unsubscribeBorrower } from "@/lib/unsubscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribe | YPN USA",
  robots: { index: false, follow: false },
};

async function confirm(formData: FormData) {
  "use server";
  const leadId = String(formData.get("l") ?? "");
  const token = String(formData.get("t") ?? "");
  const ok = unsubscribeBorrower(leadId, token, "email_unsubscribe_page");
  redirect(`/unsubscribe?done=${ok ? "1" : "0"}`);
}

type Props = { searchParams: Promise<{ l?: string; t?: string; done?: string }> };

export default async function UnsubscribePage({ searchParams }: Props) {
  const { l, t, done } = await searchParams;
  return (
    <div className="flex min-h-full flex-col bg-[#09081b] text-white">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-5 py-16">
          <h1 className="text-3xl font-semibold">Unsubscribe</h1>
          {done === "1" ? (
            <p className="text-white/85">You&rsquo;re unsubscribed. You won&rsquo;t get any more emails, texts or calls from Cerebro about this request.</p>
          ) : done === "0" ? (
            <p className="text-white/85">That link didn&rsquo;t work. Reply to the email you got and ask to be removed, and the loan officer will take you off.</p>
          ) : l && t ? (
            <form action={confirm} className="flex flex-col gap-4">
              <p className="text-white/85">Stop all emails, texts and calls from Cerebro, the AI assistant, about your mortgage request?</p>
              <input type="hidden" name="l" value={l} />
              <input type="hidden" name="t" value={t} />
              <button type="submit" className="self-start rounded-full bg-cyan-500 px-6 py-3 font-semibold text-[#09081b]">
                Unsubscribe me
              </button>
            </form>
          ) : (
            <p className="text-white/85">Use the unsubscribe link at the bottom of the email you got.</p>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
