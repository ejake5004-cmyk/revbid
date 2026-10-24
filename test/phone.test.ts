// Phone verification: number handling, the text-code flow with a stand-in for Twilio, and admin verification.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.ts";
import { normalizeUsPhone, verifierFromEnv, twilioVerifier, type PhoneVerifier } from "../src/phone.ts";
import { createServer } from "node:http";

const dirs: string[] = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

async function start(phoneVerifier: PhoneVerifier | null) {
  const dir = mkdtempSync(join(tmpdir(), "revbid-phone-"));
  dirs.push(dir);
  const app = createApp({ dbFile: join(dir, "t.db"), uploadsDir: join(dir, "up"), phoneVerifier, closeEveryMs: 60_000 });
  await new Promise<void>((r) => app.server.listen(0, r));
  const base = `http://localhost:${(app.server.address() as AddressInfo).port}`;
  const client = () => {
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
  };
  const signup = async (name: string) => {
    const c = client();
    await c("/api/signup", { username: name, email: `${name}@example.com`, password: "longenough", agreeTerms: true });
    return c;
  };
  return { app, client, signup };
}

test("US numbers are normalized and junk is rejected", () => {
  assert.equal(normalizeUsPhone("(509) 555-0142"), "+15095550142");
  assert.equal(normalizeUsPhone("+1 509 555 0142"), "+15095550142");
  assert.equal(normalizeUsPhone("15095550142"), "+15095550142");
  assert.equal(normalizeUsPhone("555-0142"), null);
  assert.equal(normalizeUsPhone("(109) 555-0142"), null);
  assert.equal(normalizeUsPhone("+44 20 7946 0958"), null);
});

test("the live site never falls back to the demo code", () => {
  assert.equal(verifierFromEnv({ DEMO_DATA: "off" }), null);
  assert.equal(verifierFromEnv({})?.mode, "demo");
  assert.equal(verifierFromEnv({ DEMO_DATA: "off", TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_VERIFY_SID: "VA1" })?.mode, "sms");
});

test("text codes: send, check, one account per number", async () => {
  // Stands in for Twilio Verify: remembers the code it "texted" to each number.
  const sent = new Map<string, string>();
  const fake: PhoneVerifier = {
    mode: "sms",
    async start(phone) {
      sent.set(phone, "482913");
    },
    async check(phone, code) {
      return sent.get(phone) === code;
    },
  };
  const { app, signup } = await start(fake);
  const ann = await signup("ann_a");
  assert.equal((await ann("/api/me")).data.verifyMode, "sms");
  assert.equal((await ann("/api/verify/start", { phone: "555-0142" })).status, 400);
  assert.equal((await ann("/api/verify/start", { phone: "(509) 555-0142" })).status, 200);
  assert.equal(sent.get("+15095550142"), "482913");
  assert.equal((await ann("/api/verify", { phone: "509 555 0142", code: "123456" })).status, 400);
  const ok = await ann("/api/verify", { phone: "509 555 0142", code: "482913" });
  assert.equal(ok.data.user.verified, true);
  assert.equal((await ann("/api/verify/start", { phone: "509 555 0199" })).status, 409);

  const bo = await signup("bo_b");
  const dup = await bo("/api/verify/start", { phone: "+1 (509) 555-0142" });
  assert.equal(dup.status, 409);
  assert.match(dup.data.error, /another account/);

  // At most 5 texts an hour per account.
  for (let i = 0; i < 5; i++) assert.equal((await bo("/api/verify/start", { phone: `509555020${i}` })).status, 200);
  assert.equal((await bo("/api/verify/start", { phone: "5095550209" })).status, 429);
  app.stop();
});

test("without Twilio, the admin verifies people by hand", async () => {
  const { app, client, signup } = await start(null);
  const cy = await signup("cy_c");
  assert.equal((await cy("/api/me")).data.verifyMode, "manual");
  assert.equal((await cy("/api/verify", { phone: "5095550142", code: "123456" })).status, 503);
  assert.equal((await cy("/api/admin/users")).status, 403);

  app.db.prepare("INSERT INTO users (username, email, pass_hash, is_admin, verified, created_at) VALUES ('boss', 'b@example.com', ?, 1, 1, 0)")
    .run((await import("../src/app.ts")).hashPassword("bosspassword"));
  const admin = client();
  await admin("/api/login", { login: "boss", password: "bosspassword" });
  const { users } = (await admin("/api/admin/users")).data;
  const target = users.find((u: any) => u.username === "cy_c");
  assert.equal(target.verified, 0);
  assert.equal((await admin(`/api/admin/users/${target.id}/verify`, {})).status, 200);
  assert.equal((await cy("/api/me")).data.user.verified, true);
  app.stop();
});

test("the Twilio adapter sends the requests Twilio Verify expects", async () => {
  const seen: { path: string; auth: string; form: Record<string, string> }[] = [];
  const fakeTwilio = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      const form = Object.fromEntries(new URLSearchParams(body));
      seen.push({ path: req.url!, auth: req.headers.authorization!, form });
      res.setHeader("Content-Type", "application/json");
      if (req.url!.endsWith("/Verifications")) return res.end(JSON.stringify({ status: "pending" }));
      if (form.Code === "111111") return res.end(JSON.stringify({ status: "approved" }));
      if (form.Code === "999999") { res.statusCode = 404; return res.end(JSON.stringify({ code: 20404 })); }
      res.end(JSON.stringify({ status: "pending" }));
    });
  });
  await new Promise<void>((r) => fakeTwilio.listen(0, r));
  const host = `http://localhost:${(fakeTwilio.address() as AddressInfo).port}`;
  const v = twilioVerifier("AC123", "secret", "VA456", host);
  await v.start("+15095550142");
  assert.equal(seen[0].path, "/v2/Services/VA456/Verifications");
  assert.equal(seen[0].auth, "Basic " + Buffer.from("AC123:secret").toString("base64"));
  assert.deepEqual(seen[0].form, { To: "+15095550142", Channel: "sms" });
  assert.equal(await v.check("+15095550142", "111111"), true);
  assert.equal(seen[1].path, "/v2/Services/VA456/VerificationCheck");
  assert.deepEqual(seen[1].form, { To: "+15095550142", Code: "111111" });
  assert.equal(await v.check("+15095550142", "222222"), false);
  assert.equal(await v.check("+15095550142", "999999"), false);
  fakeTwilio.close();
});
