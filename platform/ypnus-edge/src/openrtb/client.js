import { MAX_BID_WINDOW_MS } from "../config.js";

/**
 * Send one bid request to every DSP in parallel and return whatever has arrived when the
 * window closes. The window is a HARD ceiling (<=150ms): slow or broken DSPs are aborted and
 * reported as timeouts, they never delay the caller and they never throw.
 *
 * @returns {Promise<{dsp:string,status:'bid'|'nobid'|'timeout'|'error',ms:number,body?:object,error?:string}[]>}
 */
export async function runAuction({ dsps, request, windowMs = MAX_BID_WINDOW_MS, maxBytes = 256 * 1024, fetchImpl = fetch, now = () => performance.now() }) {
  const budget = Math.min(MAX_BID_WINDOW_MS, windowMs);
  const started = now();
  const results = [];
  const controllers = [];
  const payload = JSON.stringify(request);

  const calls = dsps.map(async (dsp) => {
    const controller = new AbortController();
    controllers.push(controller);
    const t0 = now();
    try {
      const res = await fetchImpl(dsp.url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json;charset=utf-8",
          "x-openrtb-version": "2.6",
          accept: "application/json",
          ...(dsp.bearer ? { authorization: `Bearer ${dsp.bearer}` } : {}),
        },
        body: payload,
        redirect: "error",
      });
      if (res.status === 204) {
        results.push({ dsp: dsp.id, status: "nobid", ms: now() - t0 });
        return;
      }
      if (!res.ok) {
        results.push({ dsp: dsp.id, status: "error", ms: now() - t0, error: `http_${res.status}` });
        return;
      }
      const text = await readCapped(res, maxBytes);
      results.push({ dsp: dsp.id, status: "bid", ms: now() - t0, body: JSON.parse(text) });
    } catch (err) {
      const aborted = err?.name === "AbortError" || controller.signal.aborted;
      results.push({ dsp: dsp.id, status: aborted ? "timeout" : "error", ms: now() - t0, error: aborted ? "aborted" : String(err?.message ?? err).slice(0, 80) });
    }
  });

  let timer;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(resolve, Math.max(0, budget - (now() - started)));
  });
  await Promise.race([Promise.allSettled(calls), deadline]);
  clearTimeout(timer);

  // Anything still in flight is out of time: abort it and record the timeout once.
  const answered = new Set(results.map((r) => r.dsp));
  for (const controller of controllers) controller.abort();
  for (const dsp of dsps) {
    if (!answered.has(dsp.id)) results.push({ dsp: dsp.id, status: "timeout", ms: Math.round(now() - started), error: "deadline" });
  }
  return results;
}

async function readCapped(res, maxBytes) {
  if (!res.body?.getReader) {
    const text = await res.text();
    if (text.length > maxBytes) throw new Error("response_too_large");
    return text;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("response_too_large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
