# Change log

What changed on ypnus.com for loan officers and borrowers, one entry per release, newest first.

- **Dates** are the day the build was made, in Pacific time. A build only reaches the live site once it is
  installed (see [docs/OPERATIONS.md](docs/OPERATIONS.md)); where that happened on a later day, the entry says so.
- **Build names** match the GitHub releases (`app-build-<7 characters>`). GitHub keeps only the five newest builds,
  so older ones are listed here but can no longer be downloaded.
- Each entry covers everything merged since the previous live build. The pull request numbers link the full details.
- This log starts with the move of ypnus.com off WordPress onto its own server (November 2026). Earlier work is in
  the git history and in [CHANGELOG-WP-AUDIT.md](CHANGELOG-WP-AUDIT.md).

---

## Nov 22, 2026 — next build (borrower messaging rules)

- **STOP now stops messages.** A borrower who replies STOP to a text is opted out of texts, calls and email, and
  anything still queued for them is cancelled. This needs one setting in Twilio first: see
  [docs/COMPLIANCE_MESSAGING.md](docs/COMPLIANCE_MESSAGING.md), section 4.
- **Every follow-up email has an unsubscribe link and our postal address**, and Gmail and Yahoo show their own
  unsubscribe button. Unsubscribing also cancels what was queued.
- **Every follow-up message shows the loan officer's NMLS ID** and the other required lines. A message is not sent
  if the officer has no NMLS ID on their profile, or the borrower is in a state the officer has not listed a
  license for (an officer who has listed none sends nothing to a borrower whose ZIP code is known).
  **Officers: check your NMLS ID and your state licenses are on your profile.**
- **A record of consent is kept:** when a borrower agrees to be contacted, the site now stores when, where and the
  exact question they answered.
- **No more "book a call" nudges after a borrower books one.** This also covers calls booked before this build.
- **An opt-out always wins.** Consent and bookings are checked again at the last moment before a message is
  sent, and a STOP or unsubscribe is recorded so that no earlier "yes" can outlast it.
- **Fix:** a follow-up is no longer sent to a placeholder address when a borrower left out their phone or email.

## Nov 21, 2026 — next build (groundwork for moving to a database)

Nothing changes on the live site with this build: it stays on the data file until a server setting is switched.

- **Ready to move paid plans and ZIP code locks to a PostgreSQL database**, in steps, with no downtime and with the
  data file kept as the fallback at every step. The steps and the rollback are in
  [docs/POSTGRES_PHASE1.md](docs/POSTGRES_PHASE1.md).
- **In the database, a ZIP code cannot be sold twice even if two payments arrive at the same instant:** the
  database itself refuses a second holder.
- **Fix: two plans created by an administrator could both lock the same ZIP code.** Plans with no Stripe customer
  were treated as the same owner. Each is now its own owner.
- **Health check:** shows whether a database is connected, which store is in use, and whether the two stores match.

## Nov 21, 2026 — next build (data safety and paid plans without a ZIP code)

- **Customer data is safer:** if the server ever fails to read the data file, the site now stops and shows an error
  (ZIP code checks, sign-ins and checkouts) instead of carrying on with an empty copy. Before, a sold ZIP code could
  show as open and the next save replaced the real data file. It recovers by itself once the file reads again.
- **Faster ZIP code checks as data grows:** a ZIP code check used to copy every lead and chat first. It now reads only
  the list of paid plans, and the data file is saved in a smaller form. The health check shows the data file's size
  and warns when it is getting too large for one file.
- **Paid without a ZIP code? Pick one in the dashboard:** an officer who paid before choosing a ZIP code had no
  territory and no way to fix it. The dashboard now asks them to lock an open one.
- **"Lock ZIP" buttons need a ZIP code:** on the home page, the "Lock ZIP Today" and "Lock ZIP for 5 Years" buttons
  take you to the ZIP code check first if you haven't checked one, so the ZIP code is always attached to the payment.

## Nov 21, 2026 — next build (home page follow-up)

- **Hero video is back in view:** the footage plays at full strength again. The headline, credentials and ZIP code
  check sit on solid white panels over it, so the text stays easy to read. Phones still get the still picture, not
  the video, to keep the page fast.
- **Locked ZIP code? See what is open nearby:** when a ZIP code is taken, the result now lists up to three open ZIP
  codes close by, with the town and distance. Tap one to check it.
- **Shorter home page on phones:** the calculator, the rest of each sample Cerebro conversation, Cerebro's feature
  list, the "coming soon" list and each plan's feature list open with one tap instead of being spread out. The page
  is about a fifth shorter on a phone and pricing is much closer to the top. Larger screens are unchanged.
- **Cerebro button:** on phones it also stays off the headline and stats panels at the top of the page.
- **Measurement:** the home page now records use of the sticky ZIP bar, the pricing switch, the commission
  sliders, the calculator preview, FAQ questions and the main buttons (Google Analytics events; no names or NMLS
  numbers typed into the calculator preview are recorded).

## Nov 21, 2026 — next build (home page redesign)

- **Light home page:** the home page is now white with dark text and green buttons, checked against WCAG AA
  contrast. The header and footer are light on the home page only; every other page keeps its dark look.
- **ZIP code check:** every public ZIP code field takes digits only, five at most, tells you how many digits are
  left, and the button turns solid green on the fifth digit. Once you scroll past the top of the home page a slim
  bar at the bottom shows your checked ZIP code ("93618 is OPEN") with one button, or a one-line lookup. The second
  ZIP code form half-way down the page is gone.
- **Cerebro button:** Cerebro starts as a small "Ask Cerebro" button and never sits on the ZIP code check. It opens
  its greeting by itself only after 12 seconds or 40% of the way down the page, and never once you have used a ZIP
  code field.
- **Try-it sections:** type your name and NMLS # to see them on the client calculator; three sample Cerebro
  conversations (FHA, VA, DSCR) with the lead summary and follow-up draft you would get; a table comparing YPN USA
  with shared lead vendors.
- **Pricing:** a commission slider ("1 closed loan = $5,000 commission, covering 50 months of Pro"), a Monthly /
  5-Year Territory Lock switch, and two clear buttons on each paid plan: "Lock ZIP Today (First Payment Now)" and
  "Start 15-Day Free Trial (No ZIP Lock)". Prices and checkout links are unchanged.
- **Footer:** four columns on every page (Product, Loan Programs, Markets, Company & Legal) plus one row of guides.
  The licensing line now reads "California DRE #01852847".

## Nov 17, 2026 — next build (daily health check fixes)

- **Faster home page on phones:** phones now load a light portrait version of the hero picture (about 25 KB instead
  of about 63 KB; it is the same centre view phones already saw), and the Google Analytics library loads after the
  page has finished loading instead of competing with it. Events wait in the page until it loads, then send; a
  visitor who leaves before that sends none.
- **One page title per blog post:** a post that had been pasted in as a whole web page ("The End Of Traditional
  Mortgage Leads Models") carried a second `<title>`, so Google could show the wrong one. Imported posts and pages
  now drop that wrapper and keep their content.
- **Video date Google accepts:** the home page video's upload date now includes a time and time zone.

## Nov 16, 2026 — next build (contact form and auto-install fixes)

- **Long contact messages go through whole:** the contact form now takes messages up to 5,000 characters (was
  1,000). A longer one gets a clear "please shorten" note, and the server refuses it rather than cutting it, so
  no part of a visitor's message is ever lost silently. Line breaks now show in the owner's email.
- **Auto-install is safer:** if the app fails to restart after switching builds, the old build is put back and
  checked, instead of leaving the broken one running. Pausing auto-install now also stops an install that has
  already started, before it switches builds, and waits until nothing is installing.

## Nov 16, 2026 — next build (server auto-install)

- **New builds install themselves:** once turned on with one line on the server, the server checks GitHub every 10
  minutes and installs a newer build by itself, with the same data backup, health checks and automatic rollback as a
  hand install. A build that fails its checks is rolled back and never retried. It can be paused and resumed with one
  command (docs/OPERATIONS.md, section 2). No change to the site itself. (#154)

## Nov 16, 2026 — site audit fixes (#153)

- **Contact page form works again:** the form on /contact had no handler since the move off WordPress, so a visitor's
  message went nowhere. It now reaches the YPN USA lead inbox and the owner gets an email ("New contact form message").
- **MLO marketing hub briefing form works again:** it posted to a WordPress address that no longer exists, so every
  sign-up showed an error. Sign-ups now reach the lead inbox ("New MLO briefing sign-up").
- **ZIP code forms in imported guides** submit to the live ZIP code check instead of the old WordPress page.
- **Old Google results land in one hop:** about 300 old WordPress addresses ending in "/" took two redirects to reach
  their new page; now one. A few more old addresses that showed "not found" go to their closest page, and the old
  /disclaimer page (which held a calculator, not a disclaimer) goes to Licensing & Disclosures.
- **Analytics keeps the real traffic source:** links between our own pages no longer carry campaign tags, which made
  Google Analytics credit sign-ups to "ypnus / cta" instead of the search or site that brought the visitor.
- **Search snippets:** pages whose description was CSS code, a breadcrumb trail or a five-word slogan now use the
  page's opening paragraph; long descriptions are trimmed at a word or sentence to fit search results. Local pages,
  loan program pages and comparison articles get their own social image and URL.
- **Accessibility:** "Skip to main content" works on the local mortgage pages; links in imported page text are
  underlined.

## Nov 16, 2026 — app-build-1577b79 (live)

- **Loan Officer Market Report:** /research and eight Central Valley county pages with 2024 vs 2023 public HMDA loan
  data, linked from the sitemap. (#152)

## Nov 16, 2026 — app-build-17e6e2d

- **Lead form, step 2:** if saving the optional company and team size fails, the visitor is told the extra details
  weren't saved (their request itself still went through), instead of a false "thanks". When step 2 adds new details,
  the YPN USA team gets an email with them. (#149)
- **"ZIP code" wording:** 144 imported blog pages now say "whether your ZIP code is open" and "create your free
  account" instead of showing old file names as link text; form placeholders say "Enter your ZIP code". (#148)

## Nov 16, 2026 — app-build-01c062a

- **Shorter forms and a faster ZIP code check:** on phones the ZIP code check now sits near the top of the home page,
  right under the headline and verified credentials. Asking about a ZIP code takes three fields (name, work email,
  optional phone) instead of seven, with company and team size as an optional second step. Bigger, clearer buttons.
  Prices, plans, Stripe links and SEO were not changed. (#147)
- **License disclosures on marketing drafts:** every social post, ad, marketing email and Google post Cerebro drafts
  for a signed-in officer ends with that officer's disclosures (name and NMLS ID, company NMLS ID, state lines and
  Equal Housing line). The free social writer adds them too. (#146)
- **CRM link fixes:** a lead moved to another officer now reaches that officer's CRM; brief network failures are
  retried instead of dropped; replacing the CRM address keeps existing CRM links. Page chat fixes as well. (#146)

## Nov 16, 2026 — app-build-173aca8

- **CRM link:** on Dashboard > CRM link, an officer pastes a Zapier (or any secure webhook) address and every lead
  routed to them is sent to their own CRM within seconds. The CRM can send status changes and notes back. No new
  vendor account or paid plan needed. (#145)
- Fixes for review findings in the lead score, page chat and phone alerts, including a Live Takeover that could be
  overwritten by a slow AI reply. (#145)

## Nov 16, 2026 — app-build-f16a9f7

- **Phone alerts:** officers can turn on notifications on their phone or computer for a new lead (with its lead
  score), a lead that needs them, a new chat on their page, and a borrower reply during a takeover. Alerts never
  include borrower names, contact details, ZIP codes or amounts. (#144)

## Nov 16, 2026 — app-build-1d1d7e7

- **Chat on the officer's page, with Live Takeover:** every live loan officer page has a "Chat with {name}'s
  assistant" box. Cerebro answers as the officer's AI assistant, sends the lead to that officer when they are
  licensed in the borrower's state, and shows the required disclosures. The officer can pause Cerebro and reply
  personally from a new Live chats screen. (#143)
- **Lead score:** each lead shows a 0 to 100 readiness score (hot, warm or nurture) with its top three reasons in
  plain English. It is rules only and ignores ZIP code, name, age, family status, veteran status and income, for
  fair lending. (#142)
- **Install the dashboard as a phone app:** officers can add the dashboard to their home screen, with an offline page
  when the connection drops. No borrower data is stored on the phone. (#141)
- **Cerebro for officers and borrowers:** Cerebro answers officers from their live account (plan, ZIP codes, setup
  gaps, leads) and a help guide, and borrowers from a mortgage guide. It can email borrowers on its own when an
  officer is busy (officers can switch to approve-first); every send checks consent, opt-outs, advertising rules and
  licensing, and includes a one-click unsubscribe. Prequal letters are never sent automatically.
- The health check now shows whether outgoing email is turned on.

## Nov 16, 2026 — app-build-b0b0030

- **Licensing in onboarding:** step 1 now asks for the company NMLS ID, the states the officer is licensed in, a
  California license (DRE or DFPI) and whether the company is a direct lender. Cerebro won't draft messages to
  borrowers in states the officer isn't licensed in, and disclosures use the right lines. (#140)
- Site optimizer: re-runs after an interrupted run and shows a note by the Run now button.

## Nov 16, 2026 — app-build-f2ff4a4

- **Compliance engine:** Cerebro's borrower messages (follow-ups, rate alerts and prequal letters) and officer pages
  now carry the officer's NMLS ID, the company NMLS ID, state lines (federal baseline everywhere, plus California's
  required statements) and the Equal Housing line. A missing NMLS ID shows a visible "[add your NMLS ID]" placeholder.
  (#139)
- Site optimizer: Run now works in the background, protected pages are proposed for approval instead of skipped, and
  page totals come straight from Search Console.

## Nov 16, 2026 — app-build-8bec5a1

- **Borrower data protection:** borrower names, contact details, credit answers, chat transcripts and home-equity
  figures can now be encrypted on the server (turned on for the live site the same day). Server logs mask emails,
  phone numbers and other sensitive numbers. (#138)
- **Consent:** follow-ups stop for a borrower who opted out, and texts or calls wait for 8am to 9pm local time. (#138)
- **No duplicate leads:** the same lead sent twice to the lead webhook is recorded once. (#138)

## Nov 15, 2026 — app-build-c54f992

- **Cerebro as the borrower follow-up assistant:** borrowers can share prequal basics in chat (sensitive numbers are
  scrubbed, and Cerebro never says they are prequalified) and sign up for rate alerts. In the dashboard, Cerebro finds
  consenting leads that haven't been contacted and drafts purchase, refinance and check-in messages for the officer
  to approve.
- **Site optimizer:** once a week Cerebro reads Google Search Console, finds pages that show in search but get few
  clicks, and writes better titles and descriptions for up to three of them. Pricing, legal, sign-in pages and the
  home page are never changed without approval.
- Fixes so Cerebro always writes a real reply after taking a borrower's details.

## Nov 15, 2026 — app-build-c859d55

- **No more exit pop-up:** the home page exit-intent pop-up is gone. The home page leads with a stronger headline, an
  honest line about one loan officer per ZIP code, and one main button to the ZIP code check. (#136)
- Guides and topic pages end with a clear next step, and phones show a small "Is your ZIP code open?" bar that never
  opens by itself. (#136)

## Nov 15, 2026 — app-build-8b306d2

- **SEO structure pass:** 43 thin or duplicate old WordPress pages now point to the page that covers the same topic,
  so every old address lands in one hop. Leftover code text was cleaned out of 36 migrated posts. New "Loan Officer
  Websites" topic hub and checklist post, breadcrumbs, and a fuller footer. (#135)
- Cerebro writes its reply after taking a borrower's details, instead of repeating "one moment".

## Nov 15, 2026 — app-build-6643eda

- **Cerebro does the work:** visiting loan officers can have Cerebro write a starter kit in chat (bio, Google Business
  Profile description and post, a first local blog post and a welcome email), checked against mortgage advertising
  rules and saved as a private draft page. Officers who ask YPN USA to follow up are saved, with consent.
- Borrower chat leads now go to the loan officer who holds their ZIP code, and callback requests are queued.

## Nov 10, 2026 — app-build-2187965 (installed Nov 15)

- **"ZIP code" wording and honest claims:** the site says "ZIP code" instead of bare "ZIP". One plan table drives the
  pricing page, so pages no longer disagree on what each plan includes. Unsupported claims ("3× the lead volume",
  "Live in 48 Hours") were removed. Demo buttons became self-serve sign-up buttons. Funnel steps are tracked. (#133)
- **Coming-soon labels:** features that aren't built yet (the multi-task agentic mode) are labeled as coming soon.
  (#132)
- **SEO release:** 263 old ypnus.com addresses that returned "not found" now redirect to their closest live page. New
  pages for Cerebro, teams, ROI and loan officer cities, and comparison pages against other loan officer tools.
  Google Analytics reports to the right property. (#131)
- **Speed and accessibility:** phones get a small hero image instead of a 2 MB video, old WordPress images are served
  by the app, links were fixed, and text contrast was raised. The book shows its Kindle price. (#130)

## Nov 8, 2026 — app-build-62124e8

- **Onboarding fix and loan officer pages:** a broken onboarding redirect was fixed; officers have a profile, the ZIP
  code is asked at intake, and each officer gets a public page. (#128)
- Faster home page on phones (preloaded hero image). (#125)

## Nov 7, 2026 — app-build-9e13647 (first release on the new server)

- **ypnus.com runs on its own server:** the site no longer depends on WordPress. Pages were rebuilt with the four
  plans (Free $0, Pro $99, Growth $199, Exclusive $299) and Stripe checkout links. (#120, #122)
- **Sign-in and accounts:** loan officers sign in with an emailed one-time link, and accounts are created when Stripe
  checkout completes. Visalia loan officer pages and Cerebro-first home page. (#119, #124)
- **ZIP code locks at payment:** a ZIP code is held only once the first payment goes through, with pay-now and 5-year
  prepaid options. Cerebro is on the dashboard, and its home page greeting is a solid card with one-tap next steps.
  (#126, #127)
