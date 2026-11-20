# YPN USA: Google Business Profile paste sheet

Everything below matches what ypnus.com now says in its business schema, footer and homepage FAQ.
Copy each block into the matching field in your Google Business Profile dashboard.

## Business details

| Field | Paste this |
| --- | --- |
| Business name | YPN USA |
| Website | https://ypnus.com |
| Phone | (559) 512-0372 |
| Address | 247 N L St, Dinuba, CA 93618 |
| Service area | United States (nationwide) and Central Valley, CA |
| Hours | Monday to Saturday, 9:00 AM to 5:00 PM |

## Business description (723 of 750 characters)

```
YPN USA helps licensed Mortgage Loan Officers stop buying shared leads and start owning their local market. Each paid plan includes one exclusive ZIP code within YPN USA, a local page for that ZIP code, and Cerebro AI, an assistant that answers borrower questions 24/7, qualifies them and hands ready borrowers to the loan officer with a summary. Cerebro also emails borrowers check-ins and first replies for the loan officer, on its own or after the officer approves them, and drafts local posts and Realtor co-marketing to review. Higher plans add a portable loan officer website and local city pages. Headquartered in Dinuba, CA, YPN USA serves mortgage professionals nationwide. Marketing technology only, not a lender.
```

This is your description, trimmed to what the product does today. Left out: "turnkey, high-converting mortgage websites", "automated borrower engagement", "compliance-ready local program pages" and "permanent digital assets".

## Services (each under 300 characters)

1. **Exclusive ZIP Code Territory Licensing**
   ```
   Each paid plan includes one 5-digit ZIP code that no other YPN USA loan officer can claim while you hold it. It locks at your first payment.
   ```
2. **Loan Officer Website**
   ```
   A public borrower page for each paying loan officer with licensing details and a Cerebro intake that routes leads to you, plus a portable loan officer website on Growth and Exclusive plans.
   ```
3. **Hyper-Local Mortgage SEO**
   ```
   A local page for your ZIP code on every paid plan, plus local city pages for your market on Growth and Exclusive plans, written for homebuyers searching in your area.
   ```
4. **24/7 AI Lead Capture (Cerebro AI)**
   ```
   Cerebro answers borrower questions any hour, qualifies them with consent, records the conversation and routes ready borrowers to you with a summary.
   ```
5. **Realtor Co-Marketing**
   ```
   Cerebro drafts Realtor co-marketing and local posts for you to edit and share, so you can stay in front of real estate agents who refer buyers.
   ```
6. **Borrower Follow-Up Assistant**
   ```
   Cerebro spots which borrowers need a follow-up and writes the email. By default it sends check-ins, first replies and rate alerts on its own to borrowers who agreed to be contacted, after compliance checks; in approve-first mode it holds each one for your OK. No texts or calls.
   ```

### Your original wording the product does not support yet

Not used on the site or above. Use it only once the feature is live.

| Service | Original claim | What the product does today |
| --- | --- | --- |
| Turnkey Mortgage Website Design | "High-converting, compliance-ready custom websites" | A public borrower page per paying officer, and a "portable MLO website" listed on Growth and Exclusive |
| Hyper-Local Mortgage SEO Engine | "Automated ... city/ZIP landing pages engineered to rank" | A ZIP code page plus city pages; no ranking promise |
| 24/7 AI Lead Capture | "Instant SMS/email engagement, and CRM lead routing" | Cerebro answers, qualifies and routes to you, and emails check-ins, first replies and rate alerts (on its own by default, or after your approval); it sends no texts |
| Realtor Co-Marketing Systems | "Automated co-branded listing tools and partner portals" | Cerebro drafts co-marketing posts; there are no listing tools or partner portals |
| Automated Borrower Nurture Funnels | "Multi-day SMS and email follow-up workflows" | Cerebro emails individual check-ins, first replies and rate alerts (on its own by default, or after your approval); it sends no texts or calls |

## Q&A seed entries

If your dashboard still offers Q&A, post these. The first two and the fourth also appear on the homepage FAQ.

1. **What is YPN USA and who is it built for?**
   ```
   YPN USA is an AI mortgage marketing and lead generation platform built for licensed Mortgage Loan Officers (MLOs) who want to own their local market rather than buy shared leads. Each paid plan includes an exclusive ZIP code, a local page for it and Cerebro, an AI assistant that answers and qualifies borrowers 24/7.
   ```
2. **How does the exclusive ZIP code territory model work?**
   ```
   Each paid plan includes one 5-digit ZIP code. It locks to you at your first payment, and while you hold it no other YPN USA loan officer can claim it, so you never compete with another YPN USA lender for that ZIP code's traffic or leads. Exclusivity applies within YPN USA; other lenders can still market in your area.
   ```
3. **Do I keep my leads if I switch brokerages?** (replaces "Do I own my website and digital marketing assets?")
   ```
   Yes. Borrowers Cerebro captures for you are recorded under your account and stay yours on every plan, including if you move to another company.
   ```
   Your original answer ("YPN USA builds ... digital assets ... that belong to you") conflicts with the Terms of Service, which say the platform and its content are owned by YPN Inc. Use it only if you change the Terms.
4. **Where is YPN USA located and what areas do you serve?**
   ```
   YPN USA is headquartered at 247 N L St in Dinuba, California, and serves licensed Mortgage Loan Officers nationwide across the United States.
   ```

## Files changed in the repo

| File | Change |
| --- | --- |
| `src/lib/business-profile.ts` | New: one source for name, address, phone, hours, description and the 6 services |
| `src/app/layout.tsx` | Site-wide Organization + ProfessionalService schema now uses it: legal name YPN Inc., description, hours, nationwide + Central Valley service area, 6-service offer catalog. Open Graph site name is now "YPN USA" |
| `src/app/page.tsx` | Homepage FAQ (visible accordion + FAQPage schema): added "What is YPN USA", "Where is YPN USA located", reworded the ZIP code question |
| `src/components/site-footer.tsx` | Footer line now reads "YPN USA · 247 N L St, Dinuba, CA 93618 · (559) 512-0372" |
| `src/content/wp-import/pages.json` | Agent page company line: "YPN INC" to "YPN USA" |
| `src/app/robots.ts` | Also blocks `/wp-admin/` |

Sitemap: already correct. Every URL uses https://ypnus.com, private pages (`/api`, `/dashboard`, `/admin`, login, billing) are left out, and ZIP code, city and marketing pages are included. No change needed.

robots.txt: already allowed `/`, blocked `/api/`, `/dashboard/`, `/admin/`, `/embed/`, `/analytics`, and lists `https://ypnus.com/sitemap.xml` and the local SEO sitemap. Added `/wp-admin/`.

Old references searched for:
- `http://ypnus.com`: only in the Search Console reporting code, which must match Google's property names. Left alone.
- Old Reedley address (1522 River Bluff Dr, 93654): not found.
- Old business name: removed everywhere (Nov 17, 2026). The company is YPN Inc. and the brand is YPN USA. Use no other business name in Google.
- "YPN Inc." / "YPN INC": kept in legal and publisher text (Terms, Privacy, Licensing, Accessibility, comparison page disclosures, the copyright line, the consent checkbox text, `legalName` in the schema). YPN Inc. is still the legal company name (confirmed Nov 17, 2026).
- LinkedIn: every link and schema entry now points to linkedin.com/in/davidjmoorembaypninc (confirmed Nov 17, 2026). The old /in/davidjmooreypn link is gone.
