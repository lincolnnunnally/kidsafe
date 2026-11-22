// Server-only text messages (Twilio, the provider ChurchConnect already uses). The account keys
// never leave the server.
//
// Off until a sending number is set: TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN, and either
// TWILIO_MESSAGING_SERVICE_SID (preferred: a registered messaging service) or TWILIO_FROM_NUMBER.
// A US number has to be registered with the carriers (10DLC campaign or toll-free verification)
// before texts are delivered; until then sending fails and the caller falls back to email.

export function smsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      (process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || process.env.TWILIO_FROM_NUMBER?.trim()),
  );
}

/** "(555) 010-0123" -> "+15550100123". Null when it can't be a phone we can text. */
export function toE164(raw: string | null | undefined): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (s.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function sendSms(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();
  if (!sid || !token || (!service && !from)) throw new Error("sms_not_configured");
  const number = toE164(to);
  if (!number) throw new Error("sms_bad_number");

  const form = new URLSearchParams({ To: number, Body: body.slice(0, 600) });
  if (service) form.set("MessagingServiceSid", service);
  else form.set("From", from as string);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`sms_failed_${res.status}: ${detail.slice(0, 300)}`);
  }
}
