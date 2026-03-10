import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "../../../../../lib/handler";
import { NotFoundError } from "../../../../../lib/errors";
import { emitDomainEvent } from "../../../../../lib/events";
import { prisma } from "../../../../../lib/prisma";
import { serializeExport } from "../../../v1/exports/route";

export const GET = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const exp = await prisma.export.findUnique({
      where: { id: ctx.params.id },
    });
    if (!exp) {
      throw new NotFoundError("EXPORT_NOT_FOUND", "Export not found.");
    }

    return NextResponse.json({ export: serializeExport(exp) });
  },
});

const updateSchema = z.object({
  status: z.enum(["queued", "processing", "completed", "failed"]),
  result_url: z.string().url().optional(),
  error_message: z.string().max(2000).optional(),
  row_count: z.number().int().min(0).optional(),
});

export const PATCH = createHandler({
  auth: "admin",
  validate: updateSchema,
  handler: async (ctx) => {
    const exp = await prisma.$transaction(async (tx) => {
      const existing = await tx.export.findUnique({
        where: { id: ctx.params.id },
      });
      if (!existing) {
        throw new NotFoundError("EXPORT_NOT_FOUND", "Export not found.");
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
      if (ctx.body.row_count !== undefined) {
        data.rowCount = ctx.body.row_count;
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

      const updated = await tx.export.update({
        where: { id: existing.id },
        data,
      });

      await emitDomainEvent(tx, {
        merchantId: updated.merchantId,
        type: `export.${ctx.body.status}`,
        entityType: "Export",
        entityId: updated.id,
        payload: serializeExport(updated) as Record<string, unknown>,
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });

      return updated;
    });

    return NextResponse.json({ export: serializeExport(exp) });
  },
});
