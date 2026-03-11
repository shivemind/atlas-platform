import { NextResponse } from "next/server";

import { createHandler } from "../../../../../../lib/handler";

const BILLING_SERVICE_URL =
  process.env.BILLING_SERVICE_URL || "https://atlas-billing.vercel.app";

async function handleBillingRun() {
  const res = await fetch(`${BILLING_SERVICE_URL}/api/health`, {
    headers: { "x-cron-secret": process.env.CRON_SECRET || "" },
  });

  if (!res.ok) {
    return NextResponse.json(
      { status: "error", message: "Billing service unreachable" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    status: "ok",
    message:
      "Billing cron delegated — billing runs are handled by the atlas-billing service directly",
  });
}

export const GET = createHandler({
  auth: "cron",
  handler: async () => handleBillingRun(),
});

export const POST = createHandler({
  auth: "cron",
  handler: async () => handleBillingRun(),
});
