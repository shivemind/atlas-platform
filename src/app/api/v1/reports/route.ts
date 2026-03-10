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

function serializeReport(r: {
  id: string;
  merchantId: string;
  type: string;
  name: string;
  status: string;
  parameters: unknown;
  resultUrl: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    merchant_id: r.merchantId,
    type: r.type,
    name: r.name,
    status: r.status.toLowerCase(),
    parameters: r.parameters,
    result_url: r.resultUrl,
    error_message: r.errorMessage,
    started_at: r.startedAt?.toISOString() ?? null,
    completed_at: r.completedAt?.toISOString() ?? null,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}

export { serializeReport };

const createSchema = z.object({
  type: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

export const POST = createHandler({
  auth: "merchant",
  validate: createSchema,
  handler: async (ctx) => {
    const report = await prisma.$transaction(async (tx) => {
      const created = await tx.report.create({
        data: {
          merchantId: ctx.merchantId,
          type: ctx.body.type,
          name: ctx.body.name,
          status: "QUEUED",
          parameters: ctx.body.parameters ?? undefined,
        },
      });

      await emitDomainEvent(tx, {
        merchantId: ctx.merchantId,
        type: "report.created",
        entityType: "Report",
        entityId: created.id,
        payload: serializeReport(created) as Record<string, unknown>,
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });

      return created;
    });

    return NextResponse.json(
      { report: serializeReport(report) },
      { status: 201 },
    );
  },
});

const listQuery = paginationSchema.extend({
  type: z.string().optional(),
  status: z.enum(["queued", "processing", "completed", "failed"]).optional(),
});

export const GET = createHandler({
  auth: "merchant",
  query: listQuery,
  handler: async (ctx) => {
    const where: Record<string, unknown> = { merchantId: ctx.merchantId };
    if (ctx.query.type) where.type = ctx.query.type;
    if (ctx.query.status) where.status = ctx.query.status.toUpperCase();

    const skip = paginationSkip(ctx.query);
    const [total, reports] = await Promise.all([
      prisma.report.count({ where }),
      prisma.report.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
      }),
    ]);

    return NextResponse.json({
      data: reports.map(serializeReport),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
