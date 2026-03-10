import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "../../../../../lib/handler";
import { NotFoundError } from "../../../../../lib/errors";
import { emitDomainEvent } from "../../../../../lib/events";
import { prisma } from "../../../../../lib/prisma";
import { serializeExportSchedule } from "../route";

export const GET = createHandler({
  auth: "merchant",
  handler: async (ctx) => {
    const schedule = await prisma.exportSchedule.findFirst({
      where: { id: ctx.params.id, merchantId: ctx.merchantId },
    });
    if (!schedule) {
      throw new NotFoundError(
        "EXPORT_SCHEDULE_NOT_FOUND",
        "Export schedule not found.",
      );
    }

    return NextResponse.json({
      export_schedule: serializeExportSchedule(schedule),
    });
  },
});

const updateSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly"]).optional(),
  format: z.enum(["csv", "json", "pdf"]).optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

export const PATCH = createHandler({
  auth: "merchant",
  validate: updateSchema,
  handler: async (ctx) => {
    const schedule = await prisma.$transaction(async (tx) => {
      const existing = await tx.exportSchedule.findFirst({
        where: { id: ctx.params.id, merchantId: ctx.merchantId },
      });
      if (!existing) {
        throw new NotFoundError(
          "EXPORT_SCHEDULE_NOT_FOUND",
          "Export schedule not found.",
        );
      }

      const data: Record<string, unknown> = {};
      if (ctx.body.frequency !== undefined) {
        data.frequency = ctx.body.frequency.toUpperCase();
      }
      if (ctx.body.format !== undefined) {
        data.format = ctx.body.format.toUpperCase();
      }
      if (ctx.body.parameters !== undefined) {
        data.parameters = ctx.body.parameters;
      }
      if (ctx.body.is_active !== undefined) {
        data.isActive = ctx.body.is_active;
      }

      const updated = await tx.exportSchedule.update({
        where: { id: existing.id },
        data,
      });

      await emitDomainEvent(tx, {
        merchantId: ctx.merchantId,
        type: "export_schedule.updated",
        entityType: "ExportSchedule",
        entityId: updated.id,
        payload: serializeExportSchedule(updated) as Record<string, unknown>,
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });

      return updated;
    });

    return NextResponse.json({
      export_schedule: serializeExportSchedule(schedule),
    });
  },
});

export const DELETE = createHandler({
  auth: "merchant",
  handler: async (ctx) => {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.exportSchedule.findFirst({
        where: { id: ctx.params.id, merchantId: ctx.merchantId },
      });
      if (!existing) {
        throw new NotFoundError(
          "EXPORT_SCHEDULE_NOT_FOUND",
          "Export schedule not found.",
        );
      }

      await tx.exportSchedule.delete({ where: { id: existing.id } });

      await emitDomainEvent(tx, {
        merchantId: ctx.merchantId,
        type: "export_schedule.deleted",
        entityType: "ExportSchedule",
        entityId: existing.id,
        payload: serializeExportSchedule(existing) as Record<string, unknown>,
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });
    });

    return NextResponse.json({ deleted: true, id: ctx.params.id });
  },
});
