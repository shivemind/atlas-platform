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

function serializeExport(e: {
  id: string;
  merchantId: string;
  type: string;
  format: string;
  status: string;
  parameters: unknown;
  resultUrl: string | null;
  errorMessage: string | null;
  rowCount: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: e.id,
    merchant_id: e.merchantId,
    type: e.type,
    format: e.format.toLowerCase(),
    status: e.status.toLowerCase(),
    parameters: e.parameters,
    result_url: e.resultUrl,
    error_message: e.errorMessage,
    row_count: e.rowCount,
    started_at: e.startedAt?.toISOString() ?? null,
    completed_at: e.completedAt?.toISOString() ?? null,
    created_at: e.createdAt.toISOString(),
    updated_at: e.updatedAt.toISOString(),
  };
}

export { serializeExport };

const createSchema = z.object({
  type: z.string().min(1).max(100),
  format: z.enum(["csv", "json", "pdf"]).default("csv"),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

export const POST = createHandler({
  auth: "merchant",
  validate: createSchema,
  handler: async (ctx) => {
    const exp = await prisma.$transaction(async (tx) => {
      const created = await tx.export.create({
        data: {
          merchantId: ctx.merchantId,
          type: ctx.body.type,
          format: ctx.body.format.toUpperCase() as "CSV" | "JSON" | "PDF",
          status: "QUEUED",
          parameters: ctx.body.parameters ?? undefined,
        },
      });

      await emitDomainEvent(tx, {
        merchantId: ctx.merchantId,
        type: "export.created",
        entityType: "Export",
        entityId: created.id,
        payload: serializeExport(created) as Record<string, unknown>,
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });

      return created;
    });

    return NextResponse.json(
      { export: serializeExport(exp) },
      { status: 201 },
    );
  },
});

const listQuery = paginationSchema.extend({
  type: z.string().optional(),
  status: z.enum(["queued", "processing", "completed", "failed"]).optional(),
  format: z.enum(["csv", "json", "pdf"]).optional(),
});

export const GET = createHandler({
  auth: "merchant",
  query: listQuery,
  handler: async (ctx) => {
    const where: Record<string, unknown> = { merchantId: ctx.merchantId };
    if (ctx.query.type) where.type = ctx.query.type;
    if (ctx.query.status) where.status = ctx.query.status.toUpperCase();
    if (ctx.query.format) where.format = ctx.query.format.toUpperCase();

    const skip = paginationSkip(ctx.query);
    const [total, exports] = await Promise.all([
      prisma.export.count({ where }),
      prisma.export.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
      }),
    ]);

    return NextResponse.json({
      data: exports.map(serializeExport),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
