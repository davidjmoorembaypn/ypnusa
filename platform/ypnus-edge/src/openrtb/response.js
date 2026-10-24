// Bid response validation and winner selection. A DSP response is untrusted input: anything
// that does not match the request we sent is dropped, never repaired.

const MACROS = {
  AUCTION_PRICE: (ctx) => String(ctx.price),
  AUCTION_ID: (ctx) => ctx.auctionId,
  AUCTION_BID_ID: (ctx) => ctx.bidId,
  AUCTION_IMP_ID: (ctx) => ctx.impId,
  AUCTION_SEAT_ID: (ctx) => ctx.seat,
  AUCTION_AD_ID: (ctx) => ctx.adId,
  AUCTION_CURRENCY: () => "USD",
};

export function substituteMacros(text, ctx) {
  return String(text).replace(/\$\{(AUCTION_[A-Z_]+)\}/g, (m, name) => encodeMacro(MACROS[name]?.(ctx) ?? ""));
}
const encodeMacro = (v) => String(v ?? "").replace(/[\r\n]/g, "");

/** Notice URLs are fetched by us, so they must be https and stay on the DSP's own domains. */
export function isAllowedNoticeUrl(raw, noticeDomains = []) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || /^[\d.]+$/.test(host) || host.includes(":") || host.endsWith(".internal") || host.endsWith(".local")) return false;
  return noticeDomains.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * @param {object} args
 * @param {object} args.request the OpenRTB request we sent
 * @param {{dsp:string,status:string,body?:object}[]} args.results from runAuction
 * @param {object} args.config loadConfig()
 * @returns {{winners:Map<string,object>, rejected:{dsp:string,reason:string}[]}}
 */
export function selectWinners({ request, results, config }) {
  const imps = new Map(request.imp.map((i) => [i.id, i]));
  const winners = new Map();
  const rejected = [];
  const dspById = new Map(config.dsps.map((d) => [d.id, d]));
  const blockedAdomains = new Set((config.badv ?? []).map((d) => d.toLowerCase()));
  const blockedCats = new Set(config.bcat ?? []);

  for (const result of results) {
    if (result.status !== "bid" || !result.body || typeof result.body !== "object") continue;
    const body = result.body;
    const reject = (reason) => rejected.push({ dsp: result.dsp, reason });
    if (body.id !== request.id) {
      reject("response_id_mismatch");
      continue;
    }
    if (body.cur && body.cur !== "USD") {
      reject("currency");
      continue;
    }
    const dsp = dspById.get(result.dsp);
    for (const seatbid of Array.isArray(body.seatbid) ? body.seatbid : []) {
      for (const bid of Array.isArray(seatbid?.bid) ? seatbid.bid : []) {
        const imp = imps.get(bid?.impid);
        if (!imp) {
          reject("unknown_imp");
          continue;
        }
        const price = Number(bid.price);
        if (!Number.isFinite(price) || price < imp.bidfloor) {
          reject("below_floor");
          continue;
        }
        if (typeof bid.adm !== "string" || !bid.adm || Buffer.byteLength(bid.adm) > config.maxAdmBytes) {
          reject("adm_invalid");
          continue;
        }
        if (bid.mtype !== undefined && bid.mtype !== 1) {
          reject("not_banner");
          continue;
        }
        if (Number(bid.w) !== imp.banner.w || Number(bid.h) !== imp.banner.h) {
          reject("size_mismatch");
          continue;
        }
        if (typeof bid.crid !== "string" || !bid.crid) {
          reject("no_crid");
          continue;
        }
        if ((bid.adomain ?? []).some((d) => blockedAdomains.has(String(d).toLowerCase())) || (bid.cat ?? []).some((c) => blockedCats.has(c))) {
          reject("blocked_advertiser");
          continue;
        }
        const current = winners.get(imp.id);
        if (current && current.price >= price) continue;

        const ctx = { price, auctionId: request.id, bidId: bid.id ?? "", impId: imp.id, seat: seatbid.seat ?? "", adId: bid.adid ?? "" };
        const notice = (u) => (typeof u === "string" && dsp && isAllowedNoticeUrl(substituteMacros(u, ctx), dsp.noticeDomains) ? substituteMacros(u, ctx) : null);
        winners.set(imp.id, {
          impId: imp.id,
          dsp: result.dsp,
          price,
          w: imp.banner.w,
          h: imp.banner.h,
          crid: bid.crid,
          adomain: Array.isArray(bid.adomain) ? bid.adomain.slice(0, 5) : [],
          adm: substituteMacros(bid.adm, ctx),
          nurl: notice(bid.nurl),
          burl: notice(bid.burl),
        });
      }
    }
  }
  return { winners, rejected };
}
