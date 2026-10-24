// Email alerts (new questions, outbids, results). Sent through Resend when RESEND_API_KEY and EMAIL_FROM are set;
// otherwise alerts are skipped, so the site works the same without email.

export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>;
}

export function resendMailer(apiKey: string, from: string, host = "https://api.resend.com"): Mailer {
  return {
    async send(to, subject, text) {
      const res = await fetch(`${host}/emails`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text().catch(() => "")}`);
    },
  };
}

export function mailerFromEnv(env: NodeJS.ProcessEnv): Mailer | null {
  const { RESEND_API_KEY, EMAIL_FROM } = env;
  return RESEND_API_KEY && EMAIL_FROM ? resendMailer(RESEND_API_KEY, EMAIL_FROM) : null;
}
