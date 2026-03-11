import { NextResponse } from "next/server";

import { createHandler } from "../../../../../../lib/handler";

const TREASURY_SERVICE_URL =
  process.env.TREASURY_SERVICE_URL || "https://atlas-treasury.vercel.app";

async function handleReconciliationRun() {
  const res = await fetch(`${TREASURY_SERVICE_URL}/api/health`, {
    headers: { "x-cron-secret": process.env.CRON_SECRET || "" },
  });

  if (!res.ok) {
    return NextResponse.json(
      { status: "error", message: "Treasury service unreachable" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    status: "ok",
    message:
      "Reconciliation cron delegated — runs are handled by the atlas-treasury service directly",
  });
}

export const GET = createHandler({
  auth: "cron",
  handler: async () => handleReconciliationRun(),
});

export const POST = createHandler({
  auth: "cron",
  handler: async () => handleReconciliationRun(),
});
