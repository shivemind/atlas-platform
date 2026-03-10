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
import { serializeWebhookDelivery } from "../../../../../lib/serializers";

const querySchema = paginationSchema.extend({
  merchant_id: z.string().optional(),
  status: z.enum(["PENDING", "DELIVERED", "FAILED"]).optional(),
  event_type: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const GET = createHandler({
  auth: "admin",
  query: querySchema,
  handler: async (ctx) => {
    const where: Prisma.WebhookDeliveryWhereInput = {};
    if (ctx.query.merchant_id) where.merchantId = ctx.query.merchant_id;
    if (ctx.query.status) where.status = ctx.query.status;
    if (ctx.query.event_type) where.eventType = ctx.query.event_type;
    if (ctx.query.from || ctx.query.to) {
      where.createdAt = {
        ...(ctx.query.from ? { gte: new Date(ctx.query.from) } : {}),
        ...(ctx.query.to ? { lte: new Date(ctx.query.to) } : {}),
      };
    }

    const skip = paginationSkip(ctx.query);
    const [total, deliveries] = await Promise.all([
      prisma.webhookDelivery.count({ where }),
      prisma.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
        include: {
          attempts: {
            select: {
              attemptNumber: true,
              responseStatus: true,
              createdAt: true,
              completedAt: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      data: deliveries.map(serializeWebhookDelivery),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
