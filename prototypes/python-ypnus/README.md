# YPN USA Python prototype

A small FastAPI + Jinja2 version of ypnus.com: home, pricing, zip code check, lead capture, SEO
files and a health endpoint. It is a **prototype**: it does not touch the live site, Stripe,
WordPress, DNS or the production server, and it sends no email.

## Run it locally
```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
pytest -q                                  # 12 tests
uvicorn app.main:app --reload --port 8000  # http://127.0.0.1:8000
```

## Configuration (environment variables)
| Variable | Purpose | Default |
| --- | --- | --- |
| `SITE_URL` | Canonical URLs and sitemap | `https://ypnus.com` |
| `PAYMENT_LINK_GROWTH`, `PAYMENT_LINK_PRO`, `PAYMENT_LINK_ELITE` | Stripe Payment Link per plan (use the card-required links) | unset: buttons send visitors to the zip code check |
| `GA_ID` | Google Analytics measurement ID | unset: no tracking script |
| `NMLS_DISCLOSURE` | Licensing line shown in the footer | unset |
| `YPN_DATA_DIR` | Folder for the SQLite file | `./data` |
| `BUILD_COMMIT` | Shown by `/health` | `dev` |

## What it does
- Pages: `/`, `/pricing` (Growth, Pro, Elite, Free), `/check-zip`, `/thanks`, 404.
- `GET /api/zip/{zip}`: zip code status. `POST /lead`: validated lead capture with a honeypot and a
  per-IP rate limit. Zip code claims are exclusive and atomic (`INSERT OR IGNORE`).
- SEO: unique titles and descriptions, canonical URLs, Open Graph, JSON-LD (Organization,
  SoftwareApplication, FAQ), `sitemap.xml`, `robots.txt`, one `h1` per page, mobile-first CSS,
  skip link and visible focus states.
- Security: strict CSP and other headers, parameterised SQL, non-root container.
- Copy rules: always "zip code", paid plans say "card required", no approval or lead guarantees.

## Known limits
- The zip code status comes from this app's own SQLite table. It is **not** connected to the live
  WordPress ledger, so it can disagree with ypnus.com.
- No login, subscription access, Stripe webhook, email or SMS. Paid access still lives in the
  existing WordPress and Next.js apps.
- In-memory rate limiting resets on restart and is per process. Use AWS WAF in production.
- Forms have no CSRF token (they only write low-risk lead rows). Add one before any logged-in form.

See `deploy/README.md` for AWS options.
