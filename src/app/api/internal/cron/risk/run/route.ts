import { NextResponse } from "next/server";

import { createHandler } from "../../../../../../lib/handler";

const RISK_SERVICE_URL =
  process.env.RISK_SERVICE_URL || "https://atlas-risk-disputes.vercel.app";

async function handleRiskSweep() {
  const res = await fetch(`${RISK_SERVICE_URL}/api/health`, {
    headers: { "x-cron-secret": process.env.CRON_SECRET || "" },
  });

  if (!res.ok) {
    return NextResponse.json(
      { status: "error", message: "Risk service unreachable" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    status: "ok",
    message:
      "Risk sweep cron delegated — runs are handled by the atlas-risk-disputes service directly",
  });
}

export const GET = createHandler({
  auth: "cron",
  handler: async () => handleRiskSweep(),
});

export const POST = createHandler({
  auth: "cron",
  handler: async () => handleRiskSweep(),
});
