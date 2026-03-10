import { NextResponse } from "next/server";

import { createHandler } from "../../../../../../lib/handler";
import { NotFoundError, ConflictError } from "../../../../../../lib/errors";
import { emitDomainEvent } from "../../../../../../lib/events";
import { prisma } from "../../../../../../lib/prisma";
import { serializeReport } from "../../route";

export const POST = createHandler({
  auth: "merchant",
  handler: async (ctx) => {
    const report = await prisma.$transaction(async (tx) => {
      const existing = await tx.report.findFirst({
        where: { id: ctx.params.id, merchantId: ctx.merchantId },
      });
      if (!existing) {
        throw new NotFoundError("REPORT_NOT_FOUND", "Report not found.");
      }
      if (existing.status !== "QUEUED") {
        throw new ConflictError(
          "INVALID_REPORT_STATE",
          "Only queued reports can be canceled.",
        );
      }

      const updated = await tx.report.update({
        where: { id: existing.id },
        data: { status: "FAILED", errorMessage: "Canceled by user." },
      });

      await emitDomainEvent(tx, {
        merchantId: ctx.merchantId,
        type: "report.canceled",
        entityType: "Report",
        entityId: updated.id,
        payload: serializeReport(updated) as Record<string, unknown>,
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });

      return updated;
    });

    return NextResponse.json({ report: serializeReport(report) });
  },
});
