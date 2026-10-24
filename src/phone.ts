// Phone verification. Real text codes go through Twilio Verify, which generates, sends and checks the code.
// Without Twilio settings, the demo site accepts 123456 and the live site leaves verification to the admin.

export interface PhoneVerifier {
  mode: "sms" | "demo";
  start(phone: string): Promise<void>;
  check(phone: string, code: string): Promise<boolean>;
}

export const DEMO_CODE = "123456";

// US numbers only for now: "(509) 555-0142" or "+1 509 555 0142" → "+15095550142". Anything else → null.
export function normalizeUsPhone(input: string): string | null {
  const digits = String(input ?? "").replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(ten)) return null;
  return "+1" + ten;
}

export const demoVerifier: PhoneVerifier = {
  mode: "demo",
  async start() {},
  async check(_phone, code) {
    return code === DEMO_CODE;
  },
};

export function twilioVerifier(
  accountSid: string,
  authToken: string,
  serviceSid: string,
  host = "https://verify.twilio.com",
): PhoneVerifier {
  const base = `${host}/v2/Services/${encodeURIComponent(serviceSid)}`;
  const auth = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  async function post(path: string, form: Record<string, string>) {
    const res = await fetch(base + path, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form),
    });
    const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string; code?: number };
    return { ok: res.ok, status: res.status, data };
  }
  return {
    mode: "sms",
    async start(phone) {
      const r = await post("/Verifications", { To: phone, Channel: "sms" });
      if (!r.ok) {
        console.error("Twilio Verify start failed", r.status, r.data.code, r.data.message);
        throw new Error(r.status === 429 ? "rate_limited" : "send_failed");
      }
    },
    async check(phone, code) {
      const r = await post("/VerificationCheck", { To: phone, Code: code });
      // Twilio answers 404 once a code has expired or been used up.
      if (r.status === 404) return false;
      if (!r.ok) {
        console.error("Twilio Verify check failed", r.status, r.data.code, r.data.message);
        throw new Error("check_failed");
      }
      return r.data.status === "approved";
    },
  };
}

export function verifierFromEnv(env: NodeJS.ProcessEnv): PhoneVerifier | null {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID } = env;
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VERIFY_SID)
    return twilioVerifier(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID);
  return env.DEMO_DATA === "off" ? null : demoVerifier;
}
