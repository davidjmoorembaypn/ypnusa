# ypnus-edge: WordPress replacement platform with native OpenRTB ads

Node.js + AWS foundation that replaces Hostinger/WordPress for ypnus.com: CloudFront CDN, 301
redirects that keep SEO equity, a DynamoDB-backed content model, and a programmatic ad service
(OpenRTB 2.6) that cannot slow the page down or shift its layout.

**Status:** code and tests complete and passing. **Nothing is deployed.** No AWS resource, DNS record,
DSP account or ad has been created.

## Architecture

```
Visitor ──► CloudFront (ypnus.com, www) ── WAF (managed rules + /api/ads rate limit)
              │
              ├─ viewer-request: CloudFront Function  ◄── KeyValueStore (exact legacy URL map)
              │     www→apex, /YYYY/MM/DD/slug → /blog/slug, /category|tag|author → /blog, 301 / 410
              ├─ /api/ads*      ► API Gateway HTTP API ► Lambda (arm64, Node 22)  ── DynamoDB EdgeState
              │                                          │   segments (cached, ≤25ms, fail-open)
              │                                          └─► DSPs in parallel, HARD 150ms window
              ├─ /media/*, /assets/*  ► S3 (private, OAC)   (WordPress uploads, ypn-ads.js/css)
              ├─ /wp-json/*     ► legacy WordPress (optional, until the ZIP ledger is migrated)
              └─ everything else ► ALB ► ECS Fargate: the Next.js app (EFS holds store.json)
                                         DynamoDB ContentTable: posts/pages/metadata
```

Region: the edge stack must be `us-east-1`; the web stack runs where the app already lives (`us-east-2`).

## Requirement → implementation → proof

| Requirement | Where | Proof |
| --- | --- | --- |
| Fargate or Lambda on Node.js, DynamoDB, CloudFront | `infra/edge.template.yaml`, `infra/web-fargate.template.yaml` | `cfn-lint` clean (both) |
| 301 mapping of `/category/`, `/YYYY/MM/`, etc. | `edge/redirect-core.js` (+ KeyValueStore for exact URLs) | `test/redirects.test.js`: all 330 legacy URLs + every pattern family |
| Hard 150ms DSP ceiling | `src/openrtb/client.js` (`MAX_BID_WINDOW_MS`, clamp, abort), `tmax` capped in `builder.js` | slow DSP cut off at ~150ms; window >150 clamped; end-to-end fallback < 200ms |
| Non-blocking injection, zero CLS | `public/ypn-ads.js` (`defer`, lazy via IntersectionObserver), `public/ypn-ads.css` (size reserved before JS) | Real Chrome: CLS = 0 in 12/12 scenarios (desktop + 390px phone) |
| OpenRTB JSON-over-POST builder | `src/openrtb/builder.js` (2.6: imp/banner, site, device, user, regs, source, bcat/badv, tmax, at=1) | `test/openrtb.test.js` |
| Secure response parsing | `src/openrtb/response.js`: id match, floor, exact size, USD, crid, blocklists, adm size cap, https-only notice URLs on DSP domains | `test/auction.test.js` |
| Sandboxed rendering | loader renders creatives in `iframe sandbox` (no same-origin, no top navigation) with a CSP `srcdoc`; house ads built with `textContent` | browser test + code |
| First-party segments into `User.ext` / `Segment` | `src/segments/store.js` → `user.data[].segment[]` and `user.ext.ypn.segs`; DynamoDB, Redis/Valkey, or in-memory backends | `test/service.test.js` |
| Timeout/no-bid → no thrash, no console errors | house ad in view; collapse only below the fold; internal failures return 200 + house ad, never a 5xx | Browser test: slow, no-bid, garbage, error, outage scenarios |

Run everything: `npm test` (49 unit/integration tests), `npm run test:browser` (needs Chrome, 12 browser scenarios).

## Privacy and compliance (read before enabling any DSP)

Selling or sharing visitor data with ad buyers is regulated (CCPA/CPRA "sale/sharing", GDPR/ePrivacy,
and for a mortgage business, GLBA and fair-lending advertising rules). The code is built to be
conservative; **legal review is still required before go-live.**

- **Opt-in only.** User id and segments go to DSPs only when the site's consent banner sets
  `window.YPN_CONSENT = {personalize: true, ...}` **and** no opt-out exists. Global Privacy Control,
  a US Privacy `Y` opt-out, or EEA/UK traffic without a TCF string force contextual-only requests.
  Without a consent banner, nothing personal is ever sent.
- **No borrower data, ever.** Segments come from an allow-list of behavioural ids (`reader_mlo`,
  `viewed_pricing`...). Leads, intake answers, payment and account data are never read by this service.
- **Truncated IPs** (/24, /48), hashed cookie id (HMAC), cookie is `Secure; HttpOnly; SameSite=Lax`.
- **No ads on revenue or data pages:** `/check-zip`, `/pricing`, `/billing`, `/onboarding`, `/dashboard`, `/account`,
  `/portal`, `/login`, `/consultation`, `/book`, `/claim-territory`, `/admin` (config `AD_BLOCKED_PATHS`).
- **Blocked categories** (`BLOCKED_IAB_CATEGORIES`) and advertiser domains (`BLOCKED_ADVERTISER_DOMAINS`)
  are sent in every request. Consider adding mortgage/lending competitors and anything fair-lending
  review rejects. Add a "Do Not Sell or Share My Personal Information" link and update the privacy policy.

## Known limits (honest list)

- **Cold starts.** A cold Node Lambda can take 200ms+ to init. The first request after idle may miss the
  150ms window and the visitor sees the house ad (no layout shift). If ad revenue matters, add provisioned
  concurrency or run the ad service as a second Fargate service.
- **Segments are read, not written.** Nothing here populates `SEG#<hash>` items yet; an events pipeline
  (Kinesis/Firehose → Lambda writer) is the next slice. Redis/ElastiCache needs a VPC; the DynamoDB backend
  does not, which is why it is the default. `redisKv()` and `dynamoKv()` are tested with fakes only, not against real Redis or DynamoDB.
- **The Next.js app's store is still `store.json` on EFS**, so the web tier is capped at one task, deploys with
  brief downtime, and uses the single-writer settings in `web-fargate.template.yaml`. Moving it to DynamoDB is a
  separate project. `src/content/repo.js` is the content access layer for that move (tested with a fake client only, not
  against DynamoDB; no content importer exists yet).
- **Not run against real AWS or real DSPs.** Lint-clean templates are not the same as a successful deployment.
  Expect to fix first-deploy issues (certificate validation, prefix list id, quotas).
- **CloudFront Function limits.** Rules must stay < 10KB and ~1ms compute; exact mappings belong in the
  KeyValueStore. Redirects are cached for 1 hour so a bad rule is quickly correctable; raise to a day after launch.
- **Feeds.** WordPress `/feed` goes to `/blog` because the new site has no RSS yet.
- **`/lo-signup.html` → `/pricing`** (in `edge/extra-redirects.json`) is a business decision: it ends the free,
  no-card signup path. Review it.
- Cost (rough, unverified): ~US$50-80/month before traffic (ALB, Fargate, WAF, EFS, secrets), plus CloudFront and
  DynamoDB usage. Confirm with the AWS Pricing Calculator.

See `docs/MIGRATION.md` for the ordered cutover runbook and rollback.
