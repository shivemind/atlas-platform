import { NextResponse } from "next/server";
import { z } from "zod";
import { type Prisma } from "@prisma/client";

import { createHandler } from "../../../../lib/handler";
import { prisma } from "../../../../lib/prisma";
import { serializeEvent } from "../../../../lib/serializers";

const querySchema = z.object({
  type: z.string().min(1).optional(),
  entity_type: z.string().min(1).optional(),
  entity_id: z.string().min(1).optional(),
  starting_after: z.string().min(1).optional(),
  ending_before: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const GET = createHandler({
  auth: "merchant",
  query: querySchema,
  handler: async (ctx) => {
    const { type, entity_type, entity_id, starting_after, ending_before, limit } = ctx.query;

    const where: Prisma.EventWhereInput = { merchantId: ctx.merchantId };
    if (type) where.type = type;
    if (entity_type) where.entityType = entity_type;
    if (entity_id) where.entityId = entity_id;

    if (starting_after) {
      const cursor = await prisma.event.findFirst({
        where: { id: starting_after, merchantId: ctx.merchantId },
        select: { createdAt: true },
      });
      if (cursor) {
        where.createdAt = { ...(where.createdAt as object), lt: cursor.createdAt };
      }
    }

    if (ending_before) {
      const cursor = await prisma.event.findFirst({
        where: { id: ending_before, merchantId: ctx.merchantId },
        select: { createdAt: true },
      });
      if (cursor) {
        where.createdAt = { ...(where.createdAt as object), gt: cursor.createdAt };
      }
    }

    const orderBy: Prisma.EventOrderByWithRelationInput = ending_before
      ? { createdAt: "asc" }
      : { createdAt: "desc" };

    const events = await prisma.event.findMany({
      where,
      orderBy,
      take: limit + 1,
    });

    const hasMore = events.length > limit;
    const page = hasMore ? events.slice(0, limit) : events;

    if (ending_before) page.reverse();

    return NextResponse.json({
      data: page.map(serializeEvent),
      has_more: hasMore,
    });
  },
});
