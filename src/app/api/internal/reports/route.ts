import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createHandler,
  paginationSchema,
  paginationMeta,
  paginationSkip,
} from "../../../../lib/handler";
import { prisma } from "../../../../lib/prisma";
import { serializeReport } from "../../v1/reports/route";

const listQuery = paginationSchema.extend({
  merchant_id: z.string().optional(),
  type: z.string().optional(),
  status: z.enum(["queued", "processing", "completed", "failed"]).optional(),
});

export const GET = createHandler({
  auth: "admin",
  query: listQuery,
  handler: async (ctx) => {
    const where: Record<string, unknown> = {};
    if (ctx.query.merchant_id) where.merchantId = ctx.query.merchant_id;
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
