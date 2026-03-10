import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createHandler,
  paginationSchema,
  paginationMeta,
  paginationSkip,
} from "../../../../../lib/handler";
import { prisma } from "../../../../../lib/prisma";

function serializeDeadLetter(dl: {
  id: string;
  sourceType: string;
  sourceId: string | null;
  payload: unknown;
  errorMessage: string;
  status: string;
  reprocessedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: dl.id,
    source_type: dl.sourceType,
    source_id: dl.sourceId,
    payload: dl.payload,
    error_message: dl.errorMessage,
    status: dl.status.toLowerCase(),
    reprocessed_at: dl.reprocessedAt?.toISOString() ?? null,
    created_at: dl.createdAt.toISOString(),
    updated_at: dl.updatedAt.toISOString(),
  };
}

export { serializeDeadLetter };

const listQuery = paginationSchema.extend({
  source_type: z.string().optional(),
  status: z.enum(["pending", "reprocessed", "discarded"]).optional(),
});

export const GET = createHandler({
  auth: "admin",
  query: listQuery,
  handler: async (ctx) => {
    const where: Record<string, unknown> = {};
    if (ctx.query.source_type) where.sourceType = ctx.query.source_type;
    if (ctx.query.status) where.status = ctx.query.status.toUpperCase();

    const skip = paginationSkip(ctx.query);
    const [total, deadLetters] = await Promise.all([
      prisma.deadLetter.count({ where }),
      prisma.deadLetter.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
      }),
    ]);

    return NextResponse.json({
      data: deadLetters.map(serializeDeadLetter),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
