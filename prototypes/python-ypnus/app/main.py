"""YPN USA prototype site (FastAPI + Jinja2).

Run locally:  uvicorn app.main:app --reload
Pages: /, /pricing, /check-zip, /thanks, plus /api/zip/{zip}, /health, /sitemap.xml, /robots.txt.
Nothing here sends email, charges cards or changes the live site.
"""

from __future__ import annotations

import os
import re
import time
from collections import defaultdict, deque
from pathlib import Path
from urllib.parse import urlencode

from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from . import store
from .plans import PLANS, TRIAL_DAYS, starting_price

BASE_DIR = Path(__file__).parent
SITE_URL = os.environ.get("SITE_URL", "https://ypnus.com").rstrip("/")
BUILD = os.environ.get("BUILD_COMMIT", "dev")

app = FastAPI(title="YPN USA prototype", docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

ZIP_RE = re.compile(r"^\d{5}$")
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$")
NMLS_RE = re.compile(r"^\d{4,9}$")
PLAN_IDS = {p.id for p in PLANS}

# Public pages for the sitemap: (path, priority).
PAGES = [("/", "1.0"), ("/pricing", "0.9"), ("/check-zip", "0.9")]

_hits: dict[str, deque[float]] = defaultdict(deque)


def rate_limited(request: Request, limit: int = 20, window: int = 60) -> bool:
    """Tiny in-memory per-IP limiter for the form and API. Use WAF/ALB limits in production."""
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?")
    ip = ip.split(",")[0].strip()
    now = time.monotonic()
    q = _hits[ip]
    while q and now - q[0] > window:
        q.popleft()
    if len(q) >= limit:
        return True
    q.append(now)
    return False


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self' "
        "https://www.googletagmanager.com; connect-src 'self' https://www.google-analytics.com; "
        "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    )
    if request.url.path.startswith("/static/"):
        response.headers.setdefault("Cache-Control", "public, max-age=86400")
    return response


def ctx(request: Request, **extra) -> dict:
    base = {
        "request": request,
        "site_url": SITE_URL,
        "canonical": f"{SITE_URL}{request.url.path}",
        "ga_id": os.environ.get("GA_ID", ""),
        "nmls_disclosure": os.environ.get("NMLS_DISCLOSURE", ""),
        "plans": PLANS,
        "trial_days": TRIAL_DAYS,
        "starting_price": starting_price(),
    }
    base.update(extra)
    return base


def zip_status(zip_code: str) -> dict:
    claimed = store.zip_is_claimed(zip_code)
    return {
        "zip": zip_code,
        "available": not claimed,
        "message": (
            "This zip code already has an exclusive holder."
            if claimed
            else "This zip code looks open. Availability is confirmed when you start a plan."
        ),
    }


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(
        request,
        "home.html",
        ctx(
            request,
            title="Exclusive Zip Code Leads for Loan Officers | YPN USA",
            description=(
                "YPN USA gives one loan officer per zip code an AI borrower intake assistant "
                f"and automated follow-up. Plans from {starting_price()}/mo."
            ),
        ),
    )


@app.get("/pricing", response_class=HTMLResponse)
def pricing(request: Request):
    return templates.TemplateResponse(
        request,
        "pricing.html",
        ctx(
            request,
            title="Pricing: Loan Officer Plans from $99.99/mo | YPN USA",
            description=(
                f"Compare Growth, Pro and Elite. Every paid plan includes one exclusive zip code "
                f"and a {TRIAL_DAYS}-day trial. A card is required to start."
            ),
        ),
    )


@app.get("/check-zip", response_class=HTMLResponse)
def check_zip_page(request: Request, zip: str = "", plan: str = ""):
    result = None
    error = ""
    if zip:
        if not ZIP_RE.match(zip):
            error = "Enter a five digit zip code."
        else:
            result = zip_status(zip)
    return templates.TemplateResponse(
        request,
        "check_zip.html",
        ctx(
            request,
            title="Check Your Zip Code Territory | YPN USA",
            description="Check whether your zip code still has an exclusive loan officer slot.",
            zip=zip,
            result=result,
            error=error,
            selected_plan=plan if plan in PLAN_IDS else "growth",
        ),
    )


@app.get("/api/zip/{zip_code}")
def api_zip(zip_code: str, request: Request):
    if rate_limited(request):
        return JSONResponse({"error": "Too many requests"}, status_code=429)
    if not ZIP_RE.match(zip_code):
        return JSONResponse({"error": "Zip code must be five digits"}, status_code=422)
    return zip_status(zip_code)


@app.post("/lead")
def lead(
    request: Request,
    name: str = Form(...),
    email: str = Form(...),
    zip_code: str = Form(...),
    nmls: str = Form(""),
    plan: str = Form("growth"),
    website: str = Form(""),  # honeypot: real visitors leave this empty
):
    if rate_limited(request, limit=5):
        return PlainTextResponse("Too many requests, try again in a minute.", status_code=429)
    if website:
        return RedirectResponse("/thanks", status_code=303)  # silently drop bots
    name, email, zip_code, nmls = name.strip(), email.strip(), zip_code.strip(), nmls.strip()
    problems = []
    if not 2 <= len(name) <= 120:
        problems.append("Enter your name.")
    if not EMAIL_RE.match(email):
        problems.append("Enter a valid email address.")
    if not ZIP_RE.match(zip_code):
        problems.append("Enter a five digit zip code.")
    if nmls and not NMLS_RE.match(nmls):
        problems.append("NMLS number should be digits only.")
    plan = plan if plan in PLAN_IDS else "growth"
    if problems:
        return templates.TemplateResponse(
            request,
            "check_zip.html",
            ctx(
                request,
                title="Check Your Zip Code Territory | YPN USA",
                description="Check whether your zip code still has an exclusive loan officer slot.",
                zip=zip_code,
                result=None,
                error=" ".join(problems),
                selected_plan=plan,
            ),
            status_code=422,
        )
    store.add_lead(
        name=name, email=email, zip_code=zip_code, nmls=nmls, plan_interest=plan,
        source=request.headers.get("referer", "")[:200],
    )
    return RedirectResponse(f"/thanks?{urlencode({'plan': plan})}", status_code=303)


@app.get("/thanks", response_class=HTMLResponse)
def thanks(request: Request, plan: str = "growth"):
    chosen = next((p for p in PLANS if p.id == plan), PLANS[1])
    return templates.TemplateResponse(
        request,
        "thanks.html",
        ctx(
            request,
            title="Thanks | YPN USA",
            description="We received your request.",
            chosen=chosen,
            noindex=True,
        ),
    )


@app.get("/health")
def health():
    try:
        leads = store.count_leads()
        return {"status": "ok", "build": {"commit": BUILD}, "storage": {"persistent": True, "leads": leads}}
    except Exception:  # noqa: BLE001 - health must report, never raise
        return JSONResponse({"status": "degraded", "build": {"commit": BUILD}}, status_code=503)


@app.get("/robots.txt", response_class=PlainTextResponse)
def robots():
    return f"User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: {SITE_URL}/sitemap.xml\n"


@app.get("/sitemap.xml")
def sitemap():
    urls = "".join(
        f"<url><loc>{SITE_URL}{path}</loc><priority>{prio}</priority></url>" for path, prio in PAGES
    )
    xml = f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>'
    return Response(xml, media_type="application/xml")


@app.exception_handler(404)
def not_found(request: Request, _exc):
    return templates.TemplateResponse(
        request,
        "404.html",
        ctx(request, title="Page not found | YPN USA", description="Page not found.", noindex=True),
        status_code=404,
    )
