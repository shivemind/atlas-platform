import { NextResponse } from "next/server";

import { createHandler } from "../../../../../../lib/handler";
import { prisma } from "../../../../../../lib/prisma";

async function handleReconciliationRun() {
  const now = new Date();

  const periods = await prisma.reconPeriod.findMany({
    where: { status: "OPEN", endDate: { lte: now } },
    take: 100,
  });

  let periodsReviewed = 0;

  for (const period of periods) {
    await prisma.reconPeriod.update({
      where: { id: period.id },
      data: { status: "IN_REVIEW" },
    });
    periodsReviewed++;
  }

  return NextResponse.json({
    status: "ok",
    periods_reviewed: periodsReviewed,
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
