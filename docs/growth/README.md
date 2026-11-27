# YPN USA growth preparation engine

Dependency-free Python 3.10+ CLI plus a Claude-operated research and marketing agent.
No website deployment, new API bill or database service is required. Runtime data is in
`~/.ypn-growth/growth.sqlite3` by default; set `YPN_GROWTH_DB` to a private persistent
AWS path when installed there. Back up that file. It is separate from the app's store.json.

## Start with one instruction to Claude Code

> Read docs/growth/AGENT.md and execute its research-and-draft run loop for ypnus.com.
> Initialize the engine, research the best 8 relevant opportunities, and prepare the best
> 3 submissions plus a seven-day campaign. Verify every offer and destination. Save the
> queue and drafts. Present exact submissions for my approval before any outreach or publishing.

The agent host supplies web search and the language model. The CLI handles persistence,
ranking, campaign tagging, approval state and reporting. This is not an autonomous submission
bot, background service or installed dashboard. No account access is assumed.

## CLI examples

```bash
python3 scripts/growth/engine.py init
python3 scripts/growth/engine.py report
python3 scripts/growth/engine.py add --url https://help.producthunt.com/en/articles/479557-how-to-post-a-product --title 'Evaluate Product Hunt launch' --kind directory --relevance 4 --audience 4 --effort 7 --evidence https://help.producthunt.com/en/articles/479557-how-to-post-a-product
python3 scripts/growth/engine.py tracking --url https://ypnus.com/ --source producthunt --medium referral --campaign mlo-growth-launch
```

After writing the real draft to a private file:

```bash
python3 scripts/growth/engine.py draft 1 --file /path/to/draft.md
```

Only after the owner approves the actual draft and destination:

```bash
python3 scripts/growth/engine.py approve 1 --by David --evidence 'Owner approval reference for exact saved draft and destination'
```

`record-submission ID --evidence HTTPS_RECEIPT_URL` records an already performed action;
`placement ID --url HTTPS_PUBLISHED_URL` records an independently inspected placement.
The engine makes no outbound requests. Approval is a local workflow record, not an identity
or authorization security boundary. Protect local DB access and do not treat CLI flags as
proof of real owner consent. Approval hashes bind the exact draft; updates revoke approval.

## Evidence events

Use `event ID --event-id SOURCE_ID --kind KIND --cents AMOUNT --currency USD --evidence REF`.
Reference authorized provider evidence with no customer PII. Supported kinds are visit,
lead, checkout, sale, refund, fee, tax, affiliate_pending, affiliate_approved,
affiliate_reversed and affiliate_paid. Same ID/same data is idempotent; conflicting reuse
fails. Avoid aggregate traffic imports: counts represent individual events. Sale count
includes payments/renewals and is not necessarily unique new customer count; verify a
three-new-conversion target using source records and campaign baseline.

`report` returns ranked queue records and currency-separated totals. It deliberately keeps
affiliate lifecycle amounts separate and does not include pending commissions in cash.
No native Stripe/GA4/Search Console/affiliate API sync is included in this first version.
Future connectors must authenticate separately and import stable event IDs.

## Tests

```bash
python3 -m unittest discover -s tests/growth -v
```

Only growth-tool files are changed. Application billing, existing marketingAgent.ts,
production data, AWS/DNS and schedules are untouched. Publication and deployment require
the owner's approval under the existing project instructions.
