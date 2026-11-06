# Monthly AI citation check (free method)

Run on the first business day of each month. Takes about 20 minutes. Compare with `baseline.md` (Nov 5, 2026) and the previous month.

## The 10 prompts (keep the wording exactly the same every month)

1. best mortgage CRM for loan officers 2026
2. AI tools for mortgage loan officers
3. best mortgage lead generation platform for loan officers
4. mortgage marketing automation software
5. exclusive mortgage leads by ZIP code for loan officers
6. Total Expert alternatives for loan officers
7. Bonzo vs Total Expert mortgage
8. local SEO for mortgage loan officers
9. how loan officers get more Realtor referrals with co-marketing software
10. YPN USA ypnus.com loan officers (branded)

Change the year in prompt 1 when the year changes, and note it.

## Steps

1. Open a private/incognito browser window, signed out, US location.
2. For each prompt, check these free sources and note whether ypnus.com or "YPN USA" appears:
   - **Google:** top 10 results, and the AI Overview if one shows (is ypnus.com one of its cited links?).
   - **Bing:** top 10 results (Copilot and ChatGPT search lean on Bing's index).
   - **ChatGPT (free, with search on)**, **Perplexity (free)** and **Copilot (free):** paste the prompt; record whether YPN USA is mentioned and whether a ypnus.com page is cited.
3. Record the 3 domains that show up most often for each prompt.
4. Fill in the table below and save it as `citations-YYYY-MM.md` in this folder.
5. Write 2 or 3 lines: what changed since last month, which page earned a mention, and which prompt to target next.

AI answers vary from run to run. Run each AI prompt once, in a fresh chat, and record exactly what you saw; don't re-roll for a better answer.

## Record template

| # | Prompt | Google top 10 | Google AI Overview cites us | Bing top 10 | ChatGPT mentions / cites | Perplexity mentions / cites | Copilot mentions / cites | Top 3 domains |
|---|---|---|---|---|---|---|---|---|
| 1 | best mortgage CRM for loan officers 2026 | No | No / none | No | No / No | No / No | No / No | |
| … | | | | | | | | |

Score: count of "Yes" cells out of 70 (10 prompts × 7 checks). Baseline (Nov 2026): 0 of 10 on search results; AI answers not yet recorded.

## Quick technical checks (same day)

- Google Search Console: Performance > Search results, filter Query contains "ypn" (branded impressions); Pages indexed count.
- Bing Webmaster Tools: Search Performance, and confirm the sitemap was read.
- Spot-check 3 comparison pages in Google's Rich Results Test (FAQ and Article should be detected).
- Comparison pages: any "Reviewed" date older than 6 months? Recheck that competitor's site and run `npm run build:comparisons`.

## When to consider a paid tool

If ypnus.com starts appearing in search results for 3 or more of the prompts, a paid tracker (OpenSEO AI visibility, Semrush, or Ahrefs Brand Radar) will show trends across many more prompts. Until then, this free check is enough.
