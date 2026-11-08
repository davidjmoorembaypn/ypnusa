import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-officer-profile-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const WEBP = Uint8Array.from([...Buffer.from("RIFF"), 0x10, 0x00, 0x00, 0x00, ...Buffer.from("WEBPVP8 ")]);

describe("officer profile", async () => {
  const profile = await import("./officer-profile");
  const { readDb, writeDb, setOfficerPhoto, saveAgentOnboarding } = await import("./db");
  const { draftOnboardingRecord } = await import("./agent-onboarding");

  after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  beforeEach(() => {
    writeDb((db) => {
      db.agentOnboarding = [];
      db.revenueSubscriptions = [];
      db.accounts = [];
    });
  });

  describe("field validation", () => {
    it("accepts real names and rejects junk", () => {
      assert.equal(profile.normalizeFullName("  Jane   O’Neil-Smith "), "Jane O’Neil-Smith");
      assert.equal(profile.normalizeFullName("José Álvarez"), "José Álvarez");
      for (const bad of ["", "J", "<script>", "Jane2", "-Jane", "a".repeat(81), 42]) {
        assert.equal(profile.normalizeFullName(bad), null, `rejects ${JSON.stringify(bad)}`);
      }
    });

    it("keeps NMLS IDs to 4-10 digits", () => {
      assert.equal(profile.normalizeNmlsId("787257"), "787257");
      assert.equal(profile.normalizeNmlsId("NMLS #787257"), "787257");
      assert.equal(profile.normalizeNmlsId(" 1234 "), "1234");
      for (const bad of ["123", "12345678901", "78a257", "", null]) {
        assert.equal(profile.normalizeNmlsId(bad), null, `rejects ${JSON.stringify(bad)}`);
      }
    });

    it("normalizes US phone numbers and rejects invalid ones", () => {
      for (const ok of ["(559) 512-0372", "559.512.0372", "+1 559 512 0372", "15595120372"]) {
        assert.equal(profile.normalizeUsPhone(ok), "5595120372", `accepts ${ok}`);
      }
      for (const bad of ["512-0372", "(059) 512-0372", "(559) 112-0372", "559-512-03722", "call me", "+44 20 7946 0958"]) {
        assert.equal(profile.normalizeUsPhone(bad), null, `rejects ${bad}`);
      }
      assert.equal(profile.formatUsPhone("5595120372"), "(559) 512-0372");
      assert.equal(profile.usPhoneHref("5595120372"), "tel:+15595120372");
    });

    it("validates a whole profile and names the failing field", () => {
      const ok = profile.validateOfficerProfileInput({
        fullName: "Jane Doe",
        nmlsId: "1234567",
        phone: "(559) 512-0372",
        company: "  ",
      });
      assert.deepEqual(ok, { ok: true, value: { fullName: "Jane Doe", nmlsId: "1234567", phone: "5595120372" } });
      const bad = profile.validateOfficerProfileInput({ fullName: "Jane Doe", nmlsId: "12", phone: "5595120372" });
      assert.equal(bad.ok, false);
      assert.equal(!bad.ok && bad.field, "nmlsId");
      const longCompany = profile.validateOfficerProfileInput({
        fullName: "Jane Doe",
        nmlsId: "1234567",
        phone: "5595120372",
        company: "x".repeat(101),
      });
      assert.equal(!longCompany.ok && longCompany.field, "company");
    });
  });

  describe("slugs", () => {
    it("builds a stable slug from the name and a short id, and reads the short id back", () => {
      const slug = profile.officerSlug("José Álvarez, Jr.", "acct_123");
      const shortId = profile.officerShortId("acct_123");
      assert.match(shortId, /^[0-9a-f]{8}$/);
      assert.equal(slug, `jose-alvarez-jr-${shortId}`);
      assert.equal(profile.shortIdFromSlug(slug), shortId);
      assert.equal(profile.shortIdFromSlug(shortId), shortId);
      assert.equal(profile.shortIdFromSlug("old-name-" + shortId), shortId);
      for (const bad of ["", "jane-doe", "../etc/passwd", "jane-doe-XYZ12345", "jane--doe-1a2b3c4d", 7]) {
        assert.equal(profile.shortIdFromSlug(bad), null, `rejects ${JSON.stringify(bad)}`);
      }
    });
  });

  describe("headshots", () => {
    it("detects the image type from the bytes, not the name", () => {
      assert.equal(profile.sniffImageType(JPEG), "jpg");
      assert.equal(profile.sniffImageType(PNG), "png");
      assert.equal(profile.sniffImageType(WEBP), "webp");
      assert.equal(profile.sniffImageType(Buffer.from("GIF89a....")), null);
      assert.equal(profile.sniffImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")), null);
    });

    it("stores a valid photo beside the store, replaces other formats, and rejects bad uploads", () => {
      const first = profile.saveOfficerPhoto("acct_photo", JPEG);
      assert.ok(first.ok);
      assert.ok(fs.existsSync(path.join(dataDir, "officer-photos", "acct_photo.jpg")));
      const second = profile.saveOfficerPhoto("acct_photo", PNG);
      assert.ok(second.ok && second.photo.ext === "png");
      assert.ok(!fs.existsSync(path.join(dataDir, "officer-photos", "acct_photo.jpg")), "old format removed");
      assert.deepEqual(profile.readOfficerPhoto("acct_photo", second.photo), Buffer.from(PNG));

      const gif = profile.saveOfficerPhoto("acct_photo", Buffer.from("GIF89a...."));
      assert.ok(!gif.ok && gif.status === 415);
      const huge = new Uint8Array(profile.MAX_PHOTO_BYTES + 1);
      huge.set(JPEG);
      const tooBig = profile.saveOfficerPhoto("acct_photo", huge);
      assert.ok(!tooBig.ok && tooBig.status === 413);
      const empty = profile.saveOfficerPhoto("acct_photo", new Uint8Array());
      assert.ok(!empty.ok && empty.status === 400);
    });

    it("never builds a path from an unusual id", () => {
      const saved = profile.saveOfficerPhoto("dev_a@b.com/../../x", JPEG);
      assert.ok(saved.ok);
      const files = fs.readdirSync(path.join(dataDir, "officer-photos"));
      assert.ok(files.some((file) => /^h_[0-9a-f]{32}\.jpg$/.test(file)));
      assert.ok(!fs.existsSync(path.join(dataDir, "x.jpg")));
    });

    it("keeps photo metadata server-owned: an onboarding save cannot set or drop it", () => {
      const photo = { ext: "jpg" as const, bytes: 10, updatedAt: new Date().toISOString() };
      const created = setOfficerPhoto("acct_owner", photo, () => draftOnboardingRecord("acct_owner", "o@example.com"));
      assert.deepEqual(created.officerPhoto, photo);
      const { officerPhoto: _dropped, ...withoutPhoto } = created;
      void _dropped;
      saveAgentOnboarding({ ...withoutPhoto, completedStep: 3 });
      assert.deepEqual(readDb().agentOnboarding.find((r) => r.userId === "acct_owner")?.officerPhoto, photo);
      saveAgentOnboarding({ ...withoutPhoto, officerPhoto: { ext: "png", bytes: 1, updatedAt: photo.updatedAt } });
      assert.deepEqual(readDb().agentOnboarding.find((r) => r.userId === "acct_owner")?.officerPhoto, photo);
    });
  });

  describe("public page gating", () => {
    function seed(status: "active" | "trialing" | "cancelled", claimedZips: string[], withProfile = true) {
      const now = new Date().toISOString();
      writeDb((db) => {
        db.accounts.push({ id: "acct_lo", email: "lo@example.com", role: "mlo", createdAt: now, source: "stripe_checkout" });
        db.revenueSubscriptions.push({
          id: "sub_lo",
          createdAt: now,
          startedAt: now,
          tier: "growth",
          status,
          source: "stripe_webhook",
          ownerEmail: "lo@example.com",
          claimedZips,
        });
        db.agentOnboarding.push({
          ...draftOnboardingRecord("acct_lo", "lo@example.com", now),
          ...(withProfile
            ? {
                officerProfile: {
                  fullName: "Lena Officer",
                  nmlsId: "1234567",
                  phone: "5595550100",
                  slug: profile.officerSlug("Lena Officer", "acct_lo"),
                  updatedAt: now,
                },
              }
            : {}),
        });
      });
    }

    it("is live for a paid officer with a profile and a locked ZIP code", () => {
      seed("active", ["93720", "93711"]);
      const slug = profile.officerSlug("Lena Officer", "acct_lo");
      const page = profile.findPublicOfficerPage(slug);
      assert.ok(page);
      assert.equal(page.slug, slug);
      assert.deepEqual(page.zips, ["93720", "93711"]);
      assert.equal(profile.findPublicOfficerPage(`old-name-${profile.officerShortId("acct_lo")}`)?.slug, slug);
      assert.equal(
        profile.officerIntakeHref(page),
        `/embed/intake?zip=93720&lo=${slug}&funnelSource=lo-${slug}`,
      );
      assert.equal(profile.publicOfficerPageForUser("acct_lo")?.slug, slug);
    });

    it("is not shown for a cancelled plan, an unpaid trial with no locked ZIP code, or a missing profile", () => {
      seed("cancelled", ["93720"]);
      assert.equal(profile.publicOfficerPageForUser("acct_lo"), null);
      writeDb((db) => {
        db.agentOnboarding = [];
        db.revenueSubscriptions = [];
        db.accounts = [];
      });
      seed("trialing", []);
      assert.equal(profile.publicOfficerPageForUser("acct_lo"), null);
      writeDb((db) => {
        db.agentOnboarding = [];
        db.revenueSubscriptions = [];
        db.accounts = [];
      });
      seed("active", ["93720"], false);
      assert.equal(profile.publicOfficerPageForUser("acct_lo"), null);
    });

    it("counts the profile step complete only with name, NMLS ID, phone and photo", () => {
      seed("active", ["93720"]);
      const record = readDb().agentOnboarding[0];
      assert.equal(profile.isOfficerProfileComplete(record), false);
      assert.equal(
        profile.isOfficerProfileComplete({ ...record, officerPhoto: { ext: "jpg", bytes: 1, updatedAt: record.createdAt } }),
        true,
      );
    });
  });
});
