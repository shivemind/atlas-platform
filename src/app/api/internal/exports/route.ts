import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createHandler,
  paginationSchema,
  paginationMeta,
  paginationSkip,
} from "../../../../lib/handler";
import { prisma } from "../../../../lib/prisma";
import { serializeExport } from "../../v1/exports/route";

const listQuery = paginationSchema.extend({
  merchant_id: z.string().optional(),
  type: z.string().optional(),
  status: z.enum(["queued", "processing", "completed", "failed"]).optional(),
  format: z.enum(["csv", "json", "pdf"]).optional(),
});

export const GET = createHandler({
  auth: "admin",
  query: listQuery,
  handler: async (ctx) => {
    const where: Record<string, unknown> = {};
    if (ctx.query.merchant_id) where.merchantId = ctx.query.merchant_id;
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
