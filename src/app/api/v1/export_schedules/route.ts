import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createHandler,
  paginationSchema,
  paginationMeta,
  paginationSkip,
} from "../../../../lib/handler";
import { emitDomainEvent } from "../../../../lib/events";
import { prisma } from "../../../../lib/prisma";

function serializeExportSchedule(s: {
  id: string;
  merchantId: string;
  type: string;
  format: string;
  frequency: string;
  parameters: unknown;
  isActive: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: s.id,
    merchant_id: s.merchantId,
    type: s.type,
    format: s.format.toLowerCase(),
    frequency: s.frequency.toLowerCase(),
    parameters: s.parameters,
    is_active: s.isActive,
    last_run_at: s.lastRunAt?.toISOString() ?? null,
    next_run_at: s.nextRunAt?.toISOString() ?? null,
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  };
}

export { serializeExportSchedule };

function computeNextRunAt(frequency: string, from: Date = new Date()): Date {
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
  }
  return next;
}

const createSchema = z.object({
  type: z.string().min(1).max(100),
  format: z.enum(["csv", "json", "pdf"]).default("csv"),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

export const POST = createHandler({
  auth: "merchant",
  validate: createSchema,
  handler: async (ctx) => {
    const freq = ctx.body.frequency.toUpperCase() as
      | "DAILY"
      | "WEEKLY"
      | "MONTHLY";

    const schedule = await prisma.$transaction(async (tx) => {
      const created = await tx.exportSchedule.create({
        data: {
          merchantId: ctx.merchantId,
          type: ctx.body.type,
          format: ctx.body.format.toUpperCase() as "CSV" | "JSON" | "PDF",
          frequency: freq,
          parameters: ctx.body.parameters ?? undefined,
          isActive: true,
          nextRunAt: computeNextRunAt(freq),
        },
      });

      await emitDomainEvent(tx, {
        merchantId: ctx.merchantId,
        type: "export_schedule.created",
        entityType: "ExportSchedule",
        entityId: created.id,
        payload: serializeExportSchedule(created) as Record<string, unknown>,
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });

      return created;
    });

    return NextResponse.json(
      { export_schedule: serializeExportSchedule(schedule) },
      { status: 201 },
    );
  },
});

const listQuery = paginationSchema.extend({
  type: z.string().optional(),
  is_active: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const GET = createHandler({
  auth: "merchant",
  query: listQuery,
  handler: async (ctx) => {
    const where: Record<string, unknown> = { merchantId: ctx.merchantId };
    if (ctx.query.type) where.type = ctx.query.type;
    if (ctx.query.is_active !== undefined) where.isActive = ctx.query.is_active;

    const skip = paginationSkip(ctx.query);
    const [total, schedules] = await Promise.all([
      prisma.exportSchedule.count({ where }),
      prisma.exportSchedule.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
      }),
    ]);

    return NextResponse.json({
      data: schedules.map(serializeExportSchedule),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
