import { NextResponse } from "next/server";

import { createHandler } from "../../../../../../lib/handler";
import { prisma } from "../../../../../../lib/prisma";

async function handleRiskSweep() {
  const now = new Date();

  const { count } = await prisma.riskListEntry.deleteMany({
    where: {
      expiresAt: { lte: now },
    },
  });

  return NextResponse.json({
    status: "ok",
    expired_entries_removed: count,
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
