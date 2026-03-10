import { NextResponse } from "next/server";

import { createHandler } from "../../../../../lib/handler";
import { NotFoundError } from "../../../../../lib/errors";
import { prisma } from "../../../../../lib/prisma";
import { serializeReport } from "../route";

export const GET = createHandler({
  auth: "merchant",
  handler: async (ctx) => {
    const report = await prisma.report.findFirst({
      where: { id: ctx.params.id, merchantId: ctx.merchantId },
    });
    if (!report) {
      throw new NotFoundError("REPORT_NOT_FOUND", "Report not found.");
    }

    return NextResponse.json({ report: serializeReport(report) });
  },
});
