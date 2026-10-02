import { Resend } from 'resend';

let resendClient: Resend | null = null;

export function getResend(): Resend {
  if (resendClient) return resendClient;

  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('Missing RESEND_API_KEY');

  resendClient = new Resend(key);
  return resendClient;
}

type SendResult = { data: unknown; error: { message: string; statusCode: number | null; name: string } | null };

/**
 * The Resend SDK does NOT throw on an API-level failure (invalid/unverified
 * from-address, rate limit, suppressed recipient, etc.) — it resolves with
 * `{ data: null, error: {...} }`. Every call site previously just awaited
 * `.send()` and moved on, so a rejected send looked identical to a
 * successful one: no error, no log, and (for the reminder cron) the
 * reminder got marked as sent regardless, permanently suppressing retry.
 * Call this on every send result instead of ignoring it.
 */
export function logEmailResult(context: string, result: SendResult): boolean {
  if (result.error) {
    console.error(`[email] ${context} failed: ${result.error.name} — ${result.error.message}`);
    return false;
  }
  return true;
}
