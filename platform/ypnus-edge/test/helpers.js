import http from "node:http";

export const baseConfig = (over = {}) =>
  Object.freeze({
    siteDomain: "ypnus.com",
    siteName: "YPN USA",
    publisherId: "ypnus",
    tmaxMs: 130,
    abortMs: 150,
    segmentTimeoutMs: 25,
    maxResponseBytes: 262144,
    maxAdmBytes: 102400,
    dsps: [],
    bcat: ["IAB25"],
    badv: ["badads.example"],
    blockedPathPrefixes: ["/check-zip", "/pricing"],
    allowedSizes: ["300x250", "728x90", "320x50"],
    maxSlotsPerRequest: 6,
    floorUsd: 0.25,
    hmacSecret: "test-secret-test-secret-test-secret",
    originVerify: "",
    stateTable: "",
    noticeTimeoutMs: 800,
    tokenTtlSeconds: 600,
    ...over,
  });

/** Start a throwaway HTTP server. handler(req, res, body) -> void. Returns {url, close}. */
export async function server(handler) {
  const srv = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => handler(req, res, Buffer.concat(chunks).toString()));
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const { port } = srv.address();
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => { srv.closeAllConnections?.(); srv.close(r); }) };
}

export const bidResponse = (request, { price = 1.5, w = 300, h = 250, adm = "<div>ad</div>", crid = "c1", extra = {} } = {}) => ({
  id: request.id,
  cur: "USD",
  seatbid: [{ seat: "s1", bid: [{ id: "b1", impid: request.imp[0].id, price, w, h, adm, crid, adomain: ["good.example"], nurl: "https://win.dsp.example/n?p=${AUCTION_PRICE}", burl: "https://bill.dsp.example/b", ...extra }] }],
});
