import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { GET } from "../app/api/territory/check/route";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  mock.restoreAll();
  if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
  else Object.assign(process.env, { NODE_ENV: originalNodeEnv });
});

describe("production territory availability", () => {
  it("returns retryable unavailability instead of invented inventory on upstream failure", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    mock.method(globalThis, "fetch", async () => new Response("Unavailable", { status: 503 }));
    const response = await GET(new Request("https://app.ypnus.com/api/territory/check?zip=92672"));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.equal(body.code, "TERRITORY_UNAVAILABLE");
    assert.equal(body.available, undefined);
    assert.equal(body.source, undefined);
  });

  it("preserves authoritative availability even when demo inventory disagrees", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    mock.method(globalThis, "fetch", async () => Response.json({ available: true, city: "San Clemente", state: "CA" }));
    const response = await GET(new Request("https://app.ypnus.com/api/territory/check?zip=92672"));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.available, true);
    assert.equal(body.source, "ypnus_wp");
  });

  it("rejects malformed ZIPs without contacting WordPress", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () => { throw new Error("must not call"); });
    const response = await GET(new Request("https://app.ypnus.com/api/territory/check?zip=12"));
    assert.equal((await response.json()).valid, false);
    assert.equal(fetchMock.mock.callCount(), 0);
  });
});
