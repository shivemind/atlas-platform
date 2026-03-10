import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createHandler,
  paginationMeta,
  paginationSkip,
} from "../../../../lib/handler";
import { prisma } from "../../../../lib/prisma";
import { serializeWebhookDelivery } from "../../../../lib/serializers";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(["PENDING", "DELIVERED", "FAILED"]).optional(),
  event_type: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const GET = createHandler({
  auth: "merchant",
  query: querySchema,
  handler: async (ctx) => {
    const { page, pageSize, status, event_type: eventType, from, to } = ctx.query;
    const skip = paginationSkip({ page, pageSize });

    const where = {
      merchantId: ctx.merchantId,
      ...(status ? { status } : {}),
      ...(eventType ? { eventType } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    const [total, deliveries] = await Promise.all([
      prisma.webhookDelivery.count({ where }),
      prisma.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
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
      pagination: paginationMeta({ page, pageSize }, total),
    });
  },
});
