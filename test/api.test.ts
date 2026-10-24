// End-to-end tests of the HTTP API: accounts, the review queue, live bidding and the close.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.ts";
import { seed } from "../src/seed.ts";

const MIN = 60 * 1000;
let clock = Date.parse("2026-11-01T18:00:00Z");
const dir = mkdtempSync(join(tmpdir(), "revbid-"));
const app = createApp({ dbFile: join(dir, "t.db"), uploadsDir: join(dir, "up"), now: () => clock, closeEveryMs: 60_000 });
let base = "";

before(async () => {
  seed(app.db, clock);
  await new Promise<void>((r) => app.server.listen(0, r));
  base = `http://localhost:${(app.server.address() as AddressInfo).port}`;
});
after(() => {
  app.stop();
  rmSync(dir, { recursive: true, force: true });
});

// A tiny client that keeps its own session cookie.
function client() {
  let cookie = "";
  return async (path: string, body?: object) => {
    const res = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: res.status, data: (await res.json()) as any };
  };
}

const PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const listing = {
  year: 2006, make: "Mazda", model: "MX-5 Miata", category: "performance", location: "Spokane, WA",
  story: "Bought it three years ago and it has been the summer car ever since. Never let me down.",
  issues: "Small tear in the soft top", startingBid: 1000, reserve: 6000, buyNow: "", duration: "1d", photos: [PHOTO],
  disclosures: {
    titleInHand: "yes", accident: "no", rust: "unsure", leaks: "no", warningLights: "no", modified: "no", odometer: "yes", records: "yes",
  },
};

test("full auction: sign up, verify, list, review, bid, extend, close", async () => {
  const seller = client();
  const bidder = client();
  const rival = client();
  const admin = client();

  // Accounts
  assert.equal((await seller("/api/signup", { username: "miata_mo", email: "mo@example.com", password: "short" })).status, 400);
  const s = await seller("/api/signup", { username: "miata_mo", email: "mo@example.com", password: "longenough", location: "Spokane, WA", agreeTerms: true });
  assert.equal(s.status, 200);
  assert.equal((await seller("/api/me")).data.user.username, "miata_mo");
  assert.equal((await bidder("/api/signup", { username: "MIATA_MO", email: "x@example.com", password: "longenough", agreeTerms: true })).status, 409);
  assert.equal((await bidder("/api/signup", { username: "bid_betty", email: "betty@example.com", password: "longenough" })).status, 400);
  await bidder("/api/signup", { username: "bid_betty", email: "betty@example.com", password: "longenough", agreeTerms: true });
  assert.equal((await rival("/api/login", { login: "ivy_m3", password: "wrong" })).status, 401);
  await rival("/api/login", { login: "ivy_m3", password: "revbid123" });
  await admin("/api/login", { login: "admin", password: "revbid123" });

  // Listing goes to the review queue, hidden from the public until approved.
  assert.equal((await seller("/api/listings", { ...listing, issues: "" })).status, 400);
  const created = await seller("/api/listings", listing);
  assert.equal(created.status, 200);
  const id = created.data.listing.id;
  assert.equal(created.data.listing.status, "pending");
  assert.equal(created.data.listing.photos.length, 1);
  assert.equal((await fetch(base + created.data.listing.photos[0])).headers.get("content-type"), "image/png");
  assert.equal((await bidder(`/api/listings/${id}`)).status, 404);
  assert.equal((await bidder(`/api/admin/queue`)).status, 403);
  assert.ok((await admin("/api/admin/queue")).data.listings.some((l: any) => l.id === id));
  assert.equal((await admin(`/api/admin/listings/${id}/approve`, {})).status, 200);

  // The public sees whether there is a reserve, never the amount.
  const pub = (await bidder(`/api/listings/${id}`)).data.listing;
  assert.equal(pub.status, "live");
  assert.equal(pub.hasReserve, true);
  assert.equal(pub.reserve, undefined);
  assert.equal((await seller(`/api/listings/${id}`)).data.listing.reserve, 6000);

  // Bidding rules
  let r = await bidder(`/api/listings/${id}/bids`, { amount: 1000 });
  assert.equal(r.status, 409);
  assert.equal(r.data.reason, "bidder_not_verified");
  assert.equal((await bidder("/api/verify", { phone: "509-555-0142", code: "000000" })).status, 400);
  assert.equal((await bidder("/api/verify", { phone: "509-555-0142", code: "123456" })).data.user.verified, true);
  assert.equal((await seller(`/api/listings/${id}/bids`, { amount: 1000 })).data.reason, "bidder_not_verified");
  assert.equal((await bidder(`/api/listings/${id}/bids`, { amount: 900 })).data.reason, "below_minimum");
  r = await bidder(`/api/listings/${id}/bids`, { amount: 1000 });
  assert.equal(r.status, 200);
  assert.equal(r.data.listing.highBidderIsYou, true);
  assert.equal((await bidder(`/api/listings/${id}/bids`, { amount: 2000 })).data.reason, "already_high_bidder");
  assert.equal((await rival(`/api/listings/${id}/bids`, { amount: 1049 })).data.minimumNextBid, 1050);
  assert.equal((await rival(`/api/listings/${id}/bids`, { amount: 5000 })).status, 200);

  // The seller can lower the reserve but not raise it.
  assert.equal((await seller(`/api/listings/${id}/reserve`, { reserve: 7000 })).status, 409);
  assert.equal((await rival(`/api/listings/${id}/reserve`, { reserve: 1 })).status, 409);
  assert.equal((await seller(`/api/listings/${id}/reserve`, { reserve: 5500 })).status, 200);

  // A bid in the last two minutes pushes the end out to two minutes from that bid.
  const endsAt = (await bidder(`/api/listings/${id}`)).data.listing.endsAt;
  clock = endsAt - 30_000;
  r = await bidder(`/api/listings/${id}/bids`, { amount: 5600 });
  assert.equal(r.data.extended, true);
  assert.equal(r.data.listing.endsAt, clock + 2 * MIN);

  // Close: reserve met, so it sells to the high bidder, and they see each other's contact details.
  clock += 2 * MIN;
  app.closeDue();
  const sold = (await bidder(`/api/listings/${id}`)).data.listing;
  assert.equal(sold.status, "sold");
  assert.equal(sold.finalPrice, 5600);
  assert.equal(sold.handover.role, "buyer");
  assert.equal(sold.handover.contact.email, "mo@example.com");
  const sellerView = (await seller(`/api/listings/${id}`)).data.listing;
  assert.equal(sellerView.handover.sellerFee, 280);
  assert.equal(sellerView.handover.contact.username, "bid_betty");
  assert.equal((await rival(`/api/listings/${id}`)).data.listing.handover, null);
  assert.equal((await rival(`/api/listings/${id}/bids`, { amount: 9000 })).data.reason, "auction_not_live");

  const acct = (await bidder("/api/account")).data;
  assert.equal(acct.bids.find((b: any) => b.id === id).won, true);
});

test("buy now ends the auction at once", async () => {
  const seller = client();
  const buyer = client();
  const admin = client();
  await seller("/api/login", { login: "gus_garage", password: "revbid123" });
  await buyer("/api/login", { login: "noor_na", password: "revbid123" });
  await admin("/api/login", { login: "admin", password: "revbid123" });
  const { id } = (await seller("/api/listings", { ...listing, buyNow: 9000 })).data.listing;
  await admin(`/api/admin/listings/${id}/approve`, {});
  const r = await buyer(`/api/listings/${id}/bids`, { amount: 9500 });
  assert.equal(r.data.boughtNow, true);
  assert.equal(r.data.listing.status, "sold");
  assert.equal(r.data.listing.finalPrice, 9000);
});

test("an auction that misses its reserve closes unsold", async () => {
  const seller = client();
  const bidder = client();
  const admin = client();
  await seller("/api/login", { login: "avery_t", password: "revbid123" });
  await bidder("/api/login", { login: "wes_wagon", password: "revbid123" });
  await admin("/api/login", { login: "admin", password: "revbid123" });
  const { id } = (await seller("/api/listings", listing)).data.listing;
  await admin(`/api/admin/listings/${id}/approve`, {});
  await bidder(`/api/listings/${id}/bids`, { amount: 2000 });
  clock += 2 * 24 * 60 * MIN;
  app.closeDue();
  const l = (await bidder(`/api/listings/${id}`)).data.listing;
  assert.equal(l.status, "unsold");
  assert.equal(l.handover, null);
});

test("search, filters and comments", async () => {
  const anon = client();
  const all = (await anon("/api/listings?status=all")).data.listings;
  assert.ok(all.length > 5);
  assert.ok(all.every((l: any) => !("reserve" in l)));
  const hits = (await anon("/api/listings?status=all&q=camry")).data.listings;
  assert.deepEqual(hits.map((l: any) => l.model), ["Camry LE"]);
  const user = client();
  await user("/api/login", { login: "bea_boost", password: "revbid123" });
  const c = await user(`/api/listings/${hits[0].id}/comments`, { body: "Does it come with winter tires?" });
  assert.ok(c.data.listing.comments.some((x: any) => x.body === "Does it come with winter tires?"));
  assert.equal((await anon(`/api/listings/${hits[0].id}/comments`, { body: "hi" })).status, 401);
});

test("the real site starts empty except for the admin", async () => {
  const { openDb } = await import("../src/db.ts");
  const db = openDb(":memory:");
  assert.throws(() => seed(db, clock, undefined, false));
  assert.equal(seed(db, clock, "a-strong-password", false), true);
  assert.equal((db.prepare("SELECT COUNT(*) n FROM listings").get() as { n: number }).n, 0);
  assert.deepEqual(db.prepare("SELECT username, is_admin FROM users").all().map((u: any) => [u.username, u.is_admin]), [["admin", 1]]);
  db.close();
});
