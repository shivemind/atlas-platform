import { NextResponse } from "next/server";

import { createHandler } from "../../../../../../lib/handler";
import { prisma } from "../../../../../../lib/prisma";

function computeNextRunAt(
  frequency: string,
  from: Date,
): Date {
  const next = new Date(from);
  switch (frequency) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setDate(next.getDate() + 1);
  }
  return next;
}

async function handleExportsRun() {
  const now = new Date();

  const schedules = await prisma.exportSchedule.findMany({
    where: {
      isActive: true,
      nextRunAt: { lte: now },
    },
    take: 100,
  });

  let exportsCreated = 0;

  for (const schedule of schedules) {
    await prisma.$transaction(async (tx) => {
      await tx.export.create({
        data: {
          merchantId: schedule.merchantId,
          type: schedule.type,
          format: schedule.format,
          status: "QUEUED",
          parameters: schedule.parameters ?? undefined,
        },
      });

      await tx.exportSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          nextRunAt: computeNextRunAt(schedule.frequency, now),
        },
      });

      exportsCreated++;
    });
  }

  return NextResponse.json({
    status: "ok",
    exports_created: exportsCreated,
  });
}

export const GET = createHandler({
  auth: "cron",
  handler: async () => handleExportsRun(),
});

export const POST = createHandler({
  auth: "cron",
  handler: async () => handleExportsRun(),
});
