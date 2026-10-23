# Launch kit — APPROVED by the owner on 2026-10-23 (owner sends these personally; nothing is sent by Claude)

Approved verbatim: three messages (email list, LinkedIn, Facebook). Facts checked against `src/lib/pricing.ts` and the live
pricing page: Growth $99.99/mo, 15-day trial that now REQUIRES a card (Stripe links updated 2026-10-23), cancel online anytime,
free plan available. Style rule from the owner: always write "zip code" (never "ZIP") in message copy.
Do not add claims about lead volume, results, income, or other customers.

Destination (all three): https://ypnus.com/check-zip.html (WordPress page, verified live; fires GA event `check_zip_page_view`).

## 1. Email to the owner's list
Subject: Is your zip code still open?

Hi {first name},

I built YPN USA so a loan officer can have a zip code's borrower inquiries to themselves, with an AI assistant that answers and qualifies borrowers around the clock.

You can check whether your zip code is available in about 10 seconds, free:
https://ypnus.com/check-zip.html?utm_source=email&utm_medium=owner_list&utm_campaign=first3

There's a free plan. Paid plans start at $99.99 a month and begin with a 15-day trial. The trial needs a card, and you can cancel any time online before it ends. If your zip code is taken, I'll say so honestly.

Questions? Just reply to this email and I'll answer personally.

David J. Moore, MBA
NMLS #787257 · support@ypnus.com · (559) 512-0372
YPN Inc., 247 N L Street, Dinuba, CA 93618
(Include an unsubscribe link in the email tool. Send only to people who opted in or have a real relationship with the owner.)

## 2. LinkedIn post
Most lead vendors sell the same borrower inquiry to several loan officers. I built the opposite: one YPN loan officer per zip code, plus an AI assistant that answers and qualifies borrowers in that area around the clock.

Want to know if your zip code is open? Check it free, takes about 10 seconds:
https://ypnus.com/check-zip.html?utm_source=linkedin&utm_medium=social&utm_campaign=first3

There's a free plan. Paid plans start with a 15-day trial (card required, cancel online anytime).
David J. Moore, MBA · NMLS #787257

## 3. Facebook post
Loan officers: is your zip code still open? I built YPN USA so one loan officer can have a zip code's borrower inquiries to themselves, with an AI assistant working around the clock. Check your zip code free (about 10 seconds): https://ypnus.com/check-zip.html?utm_source=facebook&utm_medium=social&utm_campaign=first3

Free plan available. Paid plans start with a 15-day trial (card required, cancel anytime). NMLS #787257

## Known copy inconsistency to fix (not in these messages)
check-zip.html's meta description says "then claim exclusive territory free", but the pricing page says a zip code is locked only
when a paid plan starts. Reconcile the WordPress page copy (needs owner approval to edit the live site).

## Measuring (nothing is a conversion until Stripe shows a succeeded live payment from a new customer)
UTM tags: utm_source = email | linkedin | facebook, utm_campaign = first3. Visits: GA4. Trials started: Stripe Subscriptions
(status Trialing, card on file). Paid: first successful invoice ~15 days after a trial starts.
