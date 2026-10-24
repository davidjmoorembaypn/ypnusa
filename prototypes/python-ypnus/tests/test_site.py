from app import store


def test_public_pages_render_with_seo_basics(client):
    for path in ("/", "/pricing", "/check-zip"):
        r = client.get(path)
        assert r.status_code == 200
        assert "<title>" in r.text and 'rel="canonical"' in r.text
        assert 'name="description"' in r.text
        assert r.text.count("<h1") == 1


def test_security_headers_present(client):
    r = client.get("/")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "frame-ancestors 'none'" in r.headers["content-security-policy"]


def test_pricing_shows_public_tiers_and_card_required(client):
    html = client.get("/pricing").text
    for name in ("Growth", "Pro", "Elite"):
        assert name in html
    assert "Starter" not in html
    assert "card required" in html
    assert "zip code" in html and "ZIP" not in html


def test_checkout_button_uses_env_payment_link(client, monkeypatch):
    monkeypatch.setenv("PAYMENT_LINK_GROWTH", "https://buy.stripe.com/test_growth")
    assert "https://buy.stripe.com/test_growth" in client.get("/pricing").text


def test_no_affirmative_guarantee_language(client):
    banned = ("guaranteed approval", "guaranteed leads", "we guarantee", "guaranteed rate", "lowest rate")
    for path in ("/", "/pricing", "/check-zip"):
        text = client.get(path).text.lower()
        assert not [phrase for phrase in banned if phrase in text]


def test_zip_api_validates_and_reports(client):
    assert client.get("/api/zip/abc").status_code == 422
    assert client.get("/api/zip/90210").json()["available"] is True
    store.claim_zip("90210", "a@example.com")
    assert client.get("/api/zip/90210").json()["available"] is False


def test_claim_zip_is_exclusive():
    assert store.claim_zip("10001", "a@example.com") is True
    assert store.claim_zip("10001", "b@example.com") is False


def test_lead_happy_path_and_validation(client):
    ok = client.post("/lead", data={"name": "Pat Lee", "email": "pat@example.com", "zip_code": "90210", "plan": "pro"})
    assert ok.status_code == 303 and ok.headers["location"].startswith("/thanks")
    assert store.count_leads() == 1
    bad = client.post("/lead", data={"name": "P", "email": "nope", "zip_code": "12", "plan": "growth"})
    assert bad.status_code == 422 and "valid email" in bad.text
    assert store.count_leads() == 1


def test_honeypot_drops_bots_without_storing(client):
    r = client.post("/lead", data={"name": "Bot Bot", "email": "b@example.com", "zip_code": "90210", "website": "x"})
    assert r.status_code == 303 and store.count_leads() == 0


def test_lead_rate_limit(client):
    codes = [client.post("/lead", data={"name": "A B", "email": "a@example.com", "zip_code": "90210"}).status_code for _ in range(7)]
    assert 429 in codes


def test_sql_injection_attempt_is_inert(client):
    client.post("/lead", data={"name": "x'); DROP TABLE leads;--", "email": "a@example.com", "zip_code": "90210"})
    assert store.count_leads() == 1


def test_health_sitemap_robots_and_404(client):
    h = client.get("/health").json()
    assert h["status"] == "ok" and h["storage"]["persistent"] is True
    assert "/pricing" in client.get("/sitemap.xml").text
    assert "Sitemap:" in client.get("/robots.txt").text
    r = client.get("/nope")
    assert r.status_code == 404 and "noindex" in r.text
