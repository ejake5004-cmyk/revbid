// Seller disclosures, email alerts, sold results and share previews.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createApp, hashPassword } from "../src/app.ts";
import type { Mailer } from "../src/email.ts";

const MIN = 60 * 1000;
let clock = Date.parse("2026-11-01T18:00:00Z");
const dir = mkdtempSync(join(tmpdir(), "revbid-feat-"));
const mail: { to: string; subject: string; text: string }[] = [];
const mailer: Mailer = { async send(to, subject, text) { mail.push({ to, subject, text }); } };
const app = createApp({
  dbFile: join(dir, "t.db"), uploadsDir: join(dir, "up"), now: () => clock, closeEveryMs: 60_000, phoneVerifier: null, mailer,
  siteUrl: "https://revbid.example",
});
await new Promise<void>((r) => app.server.listen(0, r));
const base = `http://localhost:${(app.server.address() as AddressInfo).port}`;
after(() => {
  app.stop();
  rmSync(dir, { recursive: true, force: true });
});

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
async function user(name: string, verified = true) {
  const c = client();
  await c("/api/signup", { username: name, email: `${name}@example.com`, password: "longenough", agreeTerms: true });
  if (verified) app.db.prepare("UPDATE users SET verified = 1 WHERE username = ?").run(name);
  return c;
}
app.db.prepare("INSERT INTO users (username, email, pass_hash, is_admin, verified, created_at) VALUES ('boss', 'boss@example.com', ?, 1, 1, 0)")
  .run(hashPassword("bosspassword"));
const admin = client();
await admin("/api/login", { login: "boss", password: "bosspassword" });

const PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const disclosures = {
  titleInHand: "yes", accident: "no", rust: "yes", leaks: "unsure", warningLights: "no", modified: "yes", odometer: "yes", records: "no",
};
const car = {
  year: 2004, make: "Subaru", model: "Impreza WRX STI", category: "jdm", location: "Spokane, WA",
  story: "Owned five years, daily driven in summer and stored in winter. Fun car that needs a little love.",
  issues: "Rust on the rear quarters", startingBid: 5000, reserve: "", buyNow: "", duration: "1d", photos: [PHOTO], disclosures,
};
const wait = () => new Promise((r) => setTimeout(r, 20)); // alerts are sent without holding up the request

test("listings need every disclosure answered, and buyers see the answers", async () => {
  const seller = await user("sti_sam");
  const { modified, ...partial } = disclosures;
  const bad = await seller("/api/listings", { ...car, disclosures: partial });
  assert.equal(bad.status, 400);
  assert.match(bad.data.error, /Modified from stock/);
  assert.equal((await seller("/api/listings", { ...car, disclosures: { ...disclosures, rust: "maybe" } })).status, 400);
  const ok = await seller("/api/listings", car);
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.data.listing.disclosures, disclosures);
});

test("email alerts: questions, replies, outbids and results", async () => {
  mail.length = 0;
  const seller = await user("seller_sue");
  const ann = await user("ann_bids");
  const bo = await user("bo_bids");
  const id = (await seller("/api/listings", car)).data.listing.id;
  await admin(`/api/admin/listings/${id}/approve`, {});

  // A question emails the seller; the seller's reply emails the asker, and the seller isn't emailed about their own reply.
  const q = await ann(`/api/listings/${id}/comments`, { body: "Any rust on the frame rails?" });
  await wait();
  assert.equal(mail.length, 1);
  assert.equal(mail[0].to, "seller_sue@example.com");
  assert.match(mail[0].subject, /New question on your 2004 Subaru Impreza WRX STI/);
  assert.match(mail[0].text, /Any rust on the frame rails\?/);
  assert.match(mail[0].text, new RegExp(`https://revbid.example/#/auction/${id}`));
  await seller(`/api/listings/${id}/comments`, { body: "Frame rails are solid, photos added.", parentId: q.data.listing.comments[0].id });
  await wait();
  assert.equal(mail.length, 2);
  assert.equal(mail[1].to, "ann_bids@example.com");
  assert.match(mail[1].subject, /The seller replied/);

  // Outbid: only the person who lost the lead hears about it.
  mail.length = 0;
  await ann(`/api/listings/${id}/bids`, { amount: 5000 });
  await wait();
  assert.equal(mail.length, 0);
  await bo(`/api/listings/${id}/bids`, { amount: 5100 });
  await wait();
  assert.equal(mail.length, 1);
  assert.equal(mail[0].to, "ann_bids@example.com");
  assert.match(mail[0].subject, /outbid/);
  assert.match(mail[0].text, /\$5,100/);

  // Turning alerts off stops them.
  assert.equal((await ann("/api/account/settings", { emailAlerts: false })).data.user.emailAlerts, false);
  await bo(`/api/listings/${id}/bids`, { amount: 5300 }).catch(() => {});
  await ann(`/api/listings/${id}/bids`, { amount: 5400 });
  mail.length = 0;
  await bo(`/api/listings/${id}/bids`, { amount: 5500 });
  await wait();
  assert.equal(mail.length, 0);

  // The close emails the winner and the seller.
  clock += 25 * 60 * MIN;
  app.closeDue();
  await wait();
  const to = mail.map((m) => m.to).sort();
  assert.deepEqual(to, ["bo_bids@example.com", "seller_sue@example.com"]);
  assert.match(mail.find((m) => m.to === "bo_bids@example.com")!.subject, /You won the 2004 Subaru/);
  assert.match(mail.find((m) => m.to === "seller_sue@example.com")!.subject, /sold for \$5,500/);
});

test("results list sold cars, and share links carry a preview", async () => {
  const sold = (await client()("/api/listings?status=sold")).data.listings;
  assert.ok(sold.length >= 1);
  assert.ok(sold.every((l: any) => l.status === "sold"));
  const id = sold[0].id;

  const res = await fetch(`${base}/a/${id}`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<meta property="og:title" content="2004 Subaru Impreza WRX STI on RevBid">/);
  assert.match(html, /Sold for \$5,500/);
  assert.match(html, /<meta property="og:image" content="https:\/\/revbid.example\/uploads\//);
  assert.match(html, new RegExp(`location.replace\\("/#/auction/${id}"\\)`));

  // Listings still in review aren't previewed.
  const pending = (await (await user("pend_pat"))("/api/listings", car)).data.listing.id;
  assert.equal((await fetch(`${base}/a/${pending}`)).status, 404);
});
