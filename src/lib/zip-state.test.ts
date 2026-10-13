import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeZip, readEffectiveZip, syncZipToPageUrl, ZIP_CHECKED_EVENT, ZIP_STORAGE_KEY } from "./zip-state";

describe("zip-state", () => {
  it("accepts only 5-digit ZIP codes and trims whitespace", () => {
    assert.equal(normalizeZip(" 92672 "), "92672");
    assert.equal(normalizeZip("92672"), "92672");
    assert.equal(normalizeZip("9267"), undefined);
    assert.equal(normalizeZip("abc"), undefined);
    assert.equal(normalizeZip(null), undefined);
  });

  it("prefers the current page query string over session storage", () => {
    const originalWindow = globalThis.window as any;
    const originalSessionStorage = originalWindow?.sessionStorage;

    (globalThis as any).window = {
      location: { search: "?zip=94105" },
      sessionStorage: {
        getItem: (key: string) => (key === ZIP_STORAGE_KEY ? "10001" : null),
        setItem: () => {},
        removeItem: () => {},
      },
      history: { state: null, replaceState: () => {} },
      dispatchEvent: () => {},
    };

    try {
      assert.equal(readEffectiveZip(), "94105");
    } finally {
      (globalThis as any).window = originalWindow;
      (globalThis as any).sessionStorage = originalSessionStorage;
    }
  });

  it("syncs the ZIP to the URL, session storage, and the event bus", () => {
    let lastUrl = "https://example.com/pricing";
    let storedValue: string | null = null;
    let dispatchedEvent: CustomEvent | null = null;

    const originalWindow = globalThis.window as any;
    const originalCustomEvent = globalThis.CustomEvent;

    (globalThis as any).window = {
      location: { href: lastUrl },
      history: {
        state: null,
        replaceState: (_state: unknown, _unused: string, nextUrl: URL | string) => {
          lastUrl = String(nextUrl);
        },
      },
      sessionStorage: {
        getItem: () => storedValue,
        setItem: (_key: string, value: string) => {
          storedValue = value;
        },
        removeItem: () => {
          storedValue = null;
        },
      },
      dispatchEvent: (event: CustomEvent) => {
        dispatchedEvent = event;
      },
    };

    (globalThis as any).CustomEvent = class CustomEvent<T = unknown> {
      public detail: T;
      constructor(type: string, init?: { detail?: T }) {
        this.type = type;
        this.detail = init?.detail as T;
      }
      public type: string;
    } as any;

    try {
      syncZipToPageUrl(" 90210 ");
      assert.equal(storedValue, "90210");
      assert.equal(lastUrl.includes("zip=90210"), true);
      assert.equal((dispatchedEvent as CustomEvent<{ zip: string | null }> | null)?.detail?.zip, "90210");
    } finally {
      (globalThis as any).window = originalWindow;
      (globalThis as any).CustomEvent = originalCustomEvent;
    }
  });
});
