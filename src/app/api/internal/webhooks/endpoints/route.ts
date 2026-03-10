import { NextResponse } from "next/server";
import { z } from "zod";
import { type Prisma } from "@prisma/client";

import {
  createHandler,
  paginationSchema,
  paginationMeta,
  paginationSkip,
} from "../../../../../lib/handler";
import { prisma } from "../../../../../lib/prisma";
import { serializeWebhookEndpoint } from "../../../../../lib/serializers";

const querySchema = paginationSchema.extend({
  merchant_id: z.string().optional(),
  is_active: z.enum(["true", "false"]).optional(),
});

export const GET = createHandler({
  auth: "admin",
  query: querySchema,
  handler: async (ctx) => {
    const where: Prisma.WebhookEndpointWhereInput = {};
    if (ctx.query.merchant_id) where.merchantId = ctx.query.merchant_id;
    if (ctx.query.is_active !== undefined) where.isActive = ctx.query.is_active === "true";

    const skip = paginationSkip(ctx.query);
    const [total, endpoints] = await Promise.all([
      prisma.webhookEndpoint.count({ where }),
      prisma.webhookEndpoint.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
      }),
    ]);

    return NextResponse.json({
      data: endpoints.map((e) => serializeWebhookEndpoint(e)),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
