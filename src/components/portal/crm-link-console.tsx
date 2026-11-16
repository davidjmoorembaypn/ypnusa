"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { formatDateTime } from "@/lib/format";

/**
 * CRM link settings (upgrade 2): paste a Zapier catch-hook (or any https webhook) address,
 * get the update address, token and signing secret once, send a test lead, see recent sends.
 */

interface Delivery {
  id: string;
  event: "lead.created" | "test";
  status: "pending" | "sent" | "failed";
  attempts: number;
  createdAt: string;
  sentAt?: string;
  lastHttpStatus?: number;
  lastError?: string;
}

interface LinkView {
  connected: boolean;
  connectionId?: string;
  outboundHost?: string;
  createdAt?: string;
  lastOutboundAt?: string;
  lastOutboundOk?: boolean;
  lastInboundAt?: string;
  recentDeliveries: Delivery[];
}

interface Secrets {
  signingSecret: string;
  inboundToken: string;
}

function statusLabel(delivery: Delivery): string {
  if (delivery.status === "sent") return "Delivered";
  if (delivery.status === "pending") return delivery.attempts > 0 ? "Retrying" : "Sending";
  if (delivery.lastError === "address_blocked") return "Blocked address";
  if (delivery.lastError === "redirect") return "Failed (redirected)";
  if (delivery.lastHttpStatus) return `Failed (${delivery.lastHttpStatus})`;
  return "Failed (no response)";
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/50">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-black/30 px-3 py-2 text-xs text-white/90">{value}</code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="min-h-11 shrink-0 rounded-full border border-white/15 px-4 text-xs font-semibold text-white/80 hover:bg-white/10"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function CrmLinkConsole() {
  const [link, setLink] = useState<LinkView | null>(null);
  const [url, setUrl] = useState("");
  const [secrets, setSecrets] = useState<Secrets | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/crm", { cache: "no-store" });
      const body = (await res.json()) as { ok?: boolean } & LinkView;
      if (body.ok) setLink(body);
    } catch {
      setError("Couldn't load your CRM link. Refresh to try again.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOrigin(window.location.origin);
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function connect(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: { message?: string } | string; link?: LinkView } & Partial<Secrets>;
      if (!res.ok || !body.ok || !body.signingSecret || !body.inboundToken) {
        const text = typeof body.error === "string" ? body.error : body.error?.message;
        setError(text ?? "Couldn't connect. Check the address and try again.");
        return;
      }
      setSecrets({ signingSecret: body.signingSecret, inboundToken: body.inboundToken });
      if (body.link) setLink(body.link);
      setUrl("");
      setMessage("Connected. New leads now go to your CRM.");
    } catch {
      setError("Couldn't connect. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/crm/test", { method: "POST" });
      const body = (await res.json()) as { ok?: boolean; delivery?: Delivery | null; link?: LinkView };
      if (body.link) setLink(body.link);
      if (!res.ok || !body.ok) setError("Couldn't send the test. Try again.");
      else if (body.delivery?.status === "sent") setMessage("Test lead delivered. Check your CRM or Zapier for it.");
      else setError(`Test didn't arrive: ${body.delivery ? statusLabel(body.delivery) : "no response"}. Check the address.`);
    } catch {
      setError("Couldn't send the test. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect your CRM? New leads stop going there and the update token stops working.")) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fetch("/api/integrations/crm", { method: "DELETE" });
      setSecrets(null);
      setMessage("Disconnected.");
      await load();
    } catch {
      setError("Couldn't disconnect. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!link) {
    return <p className="text-sm text-white/60">{error ?? "Loading..."}</p>;
  }

  const updateUrl = link.connectionId && origin ? `${origin}/api/webhooks/crm/${link.connectionId}` : "";

  return (
    <div className="space-y-6">
      {message ? <p className="rounded-xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200">{message}</p> : null}
      {error ? <p className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold">{link.connected ? "Your CRM is connected" : "Connect your CRM"}</h2>
        {link.connected ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-white/50">Sending to</dt>
              <dd className="font-semibold">{link.outboundHost ?? "Your address"}</dd>
            </div>
            <div>
              <dt className="text-white/50">Last lead sent</dt>
              <dd className="font-semibold">
                {link.lastOutboundAt ? `${formatDateTime(link.lastOutboundAt)}${link.lastOutboundOk === false ? " (failed)" : ""}` : "None yet"}
              </dd>
            </div>
            <div>
              <dt className="text-white/50">Last update from your CRM</dt>
              <dd className="font-semibold">{link.lastInboundAt ? formatDateTime(link.lastInboundAt) : "None yet"}</dd>
            </div>
          </dl>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-sm text-white/70">
            <li>In Zapier, start a Zap with Webhooks by Zapier, then Catch Hook.</li>
            <li>Copy the webhook address Zapier gives you and paste it below.</li>
            <li>Add your CRM as the Zap&apos;s next step, mapping the lead&apos;s name, email and phone.</li>
          </ol>
        )}

        <form onSubmit={connect} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="crm-url" className="sr-only">
            Webhook address
          </label>
          <input
            id="crm-url"
            type="url"
            inputMode="url"
            required
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://hooks.zapier.com/hooks/catch/..."
            className="h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-black/20 px-4 text-base text-white outline-none focus:border-violet-400"
          />
          <button
            type="submit"
            disabled={busy || !url.trim()}
            className="h-11 shrink-0 rounded-full bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
          >
            {link.connected ? "Replace address" : "Connect"}
          </button>
        </form>
        {link.connected ? (
          <p className="text-xs text-white/50">Replacing the address also gives you a new update token. The old one stops working.</p>
        ) : null}

        {link.connected ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void sendTest()}
              disabled={busy}
              className="min-h-11 rounded-full border border-white/15 px-5 text-sm font-semibold text-white/90 hover:bg-white/10 disabled:opacity-40"
            >
              Send a test lead
            </button>
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={busy}
              className="min-h-11 rounded-full border border-rose-400/30 px-5 text-sm font-semibold text-rose-200 hover:bg-rose-500/10 disabled:opacity-40"
            >
              Disconnect
            </button>
          </div>
        ) : null}
      </section>

      {link.connected ? (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Send updates back from your CRM (optional)</h2>
          <p className="text-sm text-white/70">
            Add a Webhooks by Zapier POST step to a Zap that runs when a lead changes in your CRM. Send to the update
            address with the header Authorization set to Bearer and your token. Fields: leadId (from the lead YPN USA
            sent), status, and note. Add externalId once to link your CRM&apos;s id, then you can use it instead of leadId.
          </p>
          {updateUrl ? <CopyRow label="Update address" value={updateUrl} /> : null}
          {secrets ? (
            <>
              <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-amber-100">
                Copy these now. They won&apos;t be shown again. If you lose them, replace the address to get new ones.
              </p>
              <CopyRow label="Update token (Authorization: Bearer ...)" value={secrets.inboundToken} />
              <CopyRow label="Signing secret (only needed if your developer checks signatures)" value={secrets.signingSecret} />
            </>
          ) : (
            <p className="text-xs text-white/50">Your token and signing secret were shown once when you connected.</p>
          )}
        </section>
      ) : null}

      {link.connected && link.recentDeliveries.length > 0 ? (
        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Recent sends</h2>
          <ul className="divide-y divide-white/10 text-sm">
            {link.recentDeliveries.map((delivery) => (
              <li key={delivery.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{delivery.event === "test" ? "Test lead" : "New lead"}</span>
                <span className="text-white/60">{formatDateTime(delivery.createdAt)}</span>
                <span
                  className={
                    delivery.status === "sent"
                      ? "font-semibold text-emerald-300"
                      : delivery.status === "failed"
                        ? "font-semibold text-rose-300"
                        : "font-semibold text-amber-200"
                  }
                >
                  {statusLabel(delivery)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
