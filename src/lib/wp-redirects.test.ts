import assert from "node:assert/strict";
import { describe, it } from "node:test";
import redirects from "../content/wp-import/redirects.json";

/**
 * next.config.ts turns redirects.json into redirects, and redirects run before routes,
 * so an entry for one of the app's own routes silently replaces that route.
 */
const APP_ROUTES = ["/onboarding", "/dashboard", "/login", "/pricing", "/lo", "/embed/intake", "/check-zip"];

describe("imported WordPress redirects", () => {
  it("never shadow the app's own routes", () => {
    const sources = Object.keys(redirects as Record<string, string>);
    for (const route of APP_ROUTES) {
      const clashes = sources.filter((source) => source === route || source === `${route}/` || source.startsWith(`${route}/`));
      assert.deepEqual(clashes, [], `${route} is redirected away by redirects.json`);
    }
  });
});
