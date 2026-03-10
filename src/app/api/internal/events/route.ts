import { NextResponse } from "next/server";
import { z } from "zod";
import { type Prisma } from "@prisma/client";

import {
  createHandler,
  paginationSchema,
  paginationMeta,
  paginationSkip,
} from "../../../../lib/handler";
import { prisma } from "../../../../lib/prisma";
import { serializeEvent } from "../../../../lib/serializers";

const querySchema = paginationSchema.extend({
  merchant_id: z.string().optional(),
  type: z.string().min(1).optional(),
  entity_type: z.string().min(1).optional(),
  entity_id: z.string().min(1).optional(),
});

export const GET = createHandler({
  auth: "admin",
  query: querySchema,
  handler: async (ctx) => {
    const where: Prisma.EventWhereInput = {};
    if (ctx.query.merchant_id) where.merchantId = ctx.query.merchant_id;
    if (ctx.query.type) where.type = ctx.query.type;
    if (ctx.query.entity_type) where.entityType = ctx.query.entity_type;
    if (ctx.query.entity_id) where.entityId = ctx.query.entity_id;

    const skip = paginationSkip(ctx.query);
    const [total, events] = await Promise.all([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
      }),
    ]);

    return NextResponse.json({
      data: events.map(serializeEvent),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
