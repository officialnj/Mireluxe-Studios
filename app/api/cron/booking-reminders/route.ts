import { NextResponse } from "next/server";
import { runDueReminders } from "@/lib/reminders/send";

export const dynamic = "force-dynamic";

// Hit hourly by Supabase pg_cron (or Vercel Cron). Protected by CRON_SECRET.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runDueReminders();
    return NextResponse.json(result, { status: result.failed.length ? 207 : 200 });
  } catch (e) {
    console.error("[booking-reminders]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
