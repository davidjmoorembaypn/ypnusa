import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { breadcrumbJsonLd, homeTrail, topicTrail } from "./breadcrumbs";

describe("breadcrumbJsonLd", () => {
  it("numbers items from 1 and makes every URL absolute on ypnus.com", () => {
    const ld = breadcrumbJsonLd(homeTrail({ name: "Pricing", href: "/pricing" }));
    assert.equal(ld["@type"], "BreadcrumbList");
    assert.deepEqual(ld.itemListElement, [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://ypnus.com/" },
      { "@type": "ListItem", position: 2, name: "Pricing", item: "https://ypnus.com/pricing" },
    ]);
  });

  it("keeps absolute URLs as they are", () => {
    const ld = breadcrumbJsonLd([{ name: "Elsewhere", href: "https://ypnus.com/x" }]);
    assert.equal(ld.itemListElement[0].item, "https://ypnus.com/x");
  });
});

describe("topicTrail", () => {
  const cluster = { slug: "loan-officer-marketing", name: "Loan Officer Marketing" };

  it("is Home > Topics > Pillar for a pillar page", () => {
    assert.deepEqual(
      topicTrail(cluster).map((c) => c.href),
      ["/", "/topics", "/topics/loan-officer-marketing"],
    );
  });

  it("adds the post for a supporting post", () => {
    const trail = topicTrail(cluster, { slug: "mortgage-marketing-ideas-for-loan-officers", title: "27 ideas" });
    assert.equal(trail.length, 4);
    assert.deepEqual(trail[3], { name: "27 ideas", href: "/blog/mortgage-marketing-ideas-for-loan-officers" });
  });
});
