# CRM link (Zapier or any webhook)

Each loan officer connects their own CRM at **Dashboard > CRM link** (`/portal/crm`). No vendor account or paid plan is needed on the YPN USA side.

## Leads going out

When a lead is routed to the officer, YPN USA sends one `POST` to the officer's https address:

```json
{
  "event": "lead.created",
  "eventId": "crmevt_...",
  "occurredAt": "2026-11-16T15:00:00.000Z",
  "source": "ypnus.com",
  "lead": {
    "id": "lead_...", "crmLeadId": "crm_...", "createdAt": "...", "status": "new_ai_routed",
    "name": "...", "email": "...", "phone": "...", "contactConsent": true,
    "zip": "93277", "loanProgram": "FHA", "purchaseOrRefinance": "purchase",
    "timeline": "...", "creditBand": "...", "propertyType": "...", "firstTimeBuyer": true,
    "leadScore": 72, "leadScoreBand": "hot", "funnelSource": "..."
  }
}
```

- Check `contactConsent` before calling or texting the borrower.
- `eventId` is the same on every retry. Drop events you've already seen.
- A failed send is retried after 30 seconds, 2 minutes and 10 minutes (a 4xx other than 408/429 is not retried). Redirects are not followed.
- **Signature:** header `X-YPN-Signature: t=<unix seconds>,v1=<hex>`, where hex is HMAC-SHA256 of `<t>.<raw body>` keyed with the signing secret shown when the officer connected. Reject old timestamps (for example over 5 minutes).

The officer's "Send a test lead" button sends `"event": "test"` with made-up details.

## Updates coming back

`POST /api/webhooks/crm/<connection id>` (the "Update address" on the settings page) with header `Authorization: Bearer <update token>` (or `X-YPN-Token`).

```json
{ "leadId": "lead_...", "externalId": "your-crm-id", "status": "Application", "note": "Sent the 1003", "updatedAt": "2026-11-16T15:30:00Z", "eventId": "optional-unique-id" }
```

- `leadId` is YPN's id (`lead.id` or `lead.crmLeadId` from the outbound event). Send it with `externalId` once to link your CRM's id; after that `externalId` alone works.
- It never creates a lead, and only reaches leads routed to that officer.
- The same `eventId` (or, without one, the same body) is applied once. An update with an older `updatedAt` than the last one is ignored.
- Replies: `200 {"ok":true,"leadId":...,"applied":[...]}`, `401` wrong token, `404` no matching lead, `409` externalId already linked to another lead.
