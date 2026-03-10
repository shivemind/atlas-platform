import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "../../../../../lib/handler";
import { NotFoundError } from "../../../../../lib/errors";
import { emitDomainEvent } from "../../../../../lib/events";
import { prisma } from "../../../../../lib/prisma";
import { serializeReport } from "../../../v1/reports/route";

export const GET = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const report = await prisma.report.findUnique({
      where: { id: ctx.params.id },
    });
    if (!report) {
      throw new NotFoundError("REPORT_NOT_FOUND", "Report not found.");
    }

    return NextResponse.json({ report: serializeReport(report) });
  },
});

const updateSchema = z.object({
  status: z.enum(["queued", "processing", "completed", "failed"]),
  result_url: z.string().url().optional(),
  error_message: z.string().max(2000).optional(),
});

export const PATCH = createHandler({
  auth: "admin",
  validate: updateSchema,
  handler: async (ctx) => {
    const report = await prisma.$transaction(async (tx) => {
      const existing = await tx.report.findUnique({
        where: { id: ctx.params.id },
      });
      if (!existing) {
        throw new NotFoundError("REPORT_NOT_FOUND", "Report not found.");
      }

      const now = new Date();
      const data: Record<string, unknown> = {
        status: ctx.body.status.toUpperCase(),
      };
      if (ctx.body.result_url !== undefined) {
        data.resultUrl = ctx.body.result_url;
      }
      if (ctx.body.error_message !== undefined) {
        data.errorMessage = ctx.body.error_message;
      }
      if (ctx.body.status === "processing" && !existing.startedAt) {
        data.startedAt = now;
      }
      if (
        ctx.body.status === "completed" ||
        ctx.body.status === "failed"
      ) {
        data.completedAt = now;
      }

      const updated = await tx.report.update({
        where: { id: existing.id },
        data,
      });

      await emitDomainEvent(tx, {
        merchantId: updated.merchantId,
        type: `report.${ctx.body.status}`,
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
