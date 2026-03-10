import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createHandler,
  paginationSchema,
  paginationMeta,
  paginationSkip,
} from "../../../../../lib/handler";
import { prisma } from "../../../../../lib/prisma";

function serializeJob(j: {
  id: string;
  type: string;
  status: string;
  payload: unknown;
  result: unknown;
  errorMessage: string | null;
  attempts: number;
  maxAttempts: number;
  scheduledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: j.id,
    type: j.type,
    status: j.status.toLowerCase(),
    payload: j.payload,
    result: j.result,
    error_message: j.errorMessage,
    attempts: j.attempts,
    max_attempts: j.maxAttempts,
    scheduled_at: j.scheduledAt.toISOString(),
    started_at: j.startedAt?.toISOString() ?? null,
    completed_at: j.completedAt?.toISOString() ?? null,
    created_at: j.createdAt.toISOString(),
    updated_at: j.updatedAt.toISOString(),
  };
}

export { serializeJob };

const createSchema = z.object({
  type: z.string().min(1).max(100),
  payload: z.record(z.string(), z.unknown()).optional(),
  max_attempts: z.number().int().min(1).max(100).default(3),
  scheduled_at: z.string().datetime().optional(),
});

export const POST = createHandler({
  auth: "admin",
  validate: createSchema,
  handler: async (ctx) => {
    const job = await prisma.job.create({
      data: {
        type: ctx.body.type,
        status: "QUEUED",
        payload: ctx.body.payload ?? undefined,
        maxAttempts: ctx.body.max_attempts,
        scheduledAt: ctx.body.scheduled_at
          ? new Date(ctx.body.scheduled_at)
          : new Date(),
      },
    });

    return NextResponse.json({ job: serializeJob(job) }, { status: 201 });
  },
});

const listQuery = paginationSchema.extend({
  type: z.string().optional(),
  status: z
    .enum(["queued", "running", "completed", "failed", "canceled"])
    .optional(),
});

export const GET = createHandler({
  auth: "admin",
  query: listQuery,
  handler: async (ctx) => {
    const where: Record<string, unknown> = {};
    if (ctx.query.type) where.type = ctx.query.type;
    if (ctx.query.status) where.status = ctx.query.status.toUpperCase();

    const skip = paginationSkip(ctx.query);
    const [total, jobs] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
      }),
    ]);

    return NextResponse.json({
      data: jobs.map(serializeJob),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
