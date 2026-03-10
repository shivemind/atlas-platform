import { NextResponse } from "next/server";
import { type Prisma } from "@prisma/client";
import { z } from "zod";

import {
  createHandler,
  paginationSchema,
  paginationMeta,
  paginationSkip,
} from "../../../../lib/handler";
import { prisma } from "../../../../lib/prisma";

function serializeAuditLog(log: {
  id: string;
  merchantId: string;
  action: string;
  actorType: string;
  actorId: string;
  entityType: string;
  entityId: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}) {
  return {
    id: log.id,
    merchant_id: log.merchantId,
    action: log.action,
    actor_type: log.actorType,
    actor_id: log.actorId,
    entity_type: log.entityType,
    entity_id: log.entityId,
    metadata: log.metadata,
    created_at: log.createdAt.toISOString(),
  };
}

const auditLogsQuery = paginationSchema.extend({
  action: z.string().optional(),
  actor_type: z.string().optional(),
  actor_id: z.string().optional(),
  entity_type: z.string().optional(),
  entity_id: z.string().optional(),
  merchant_id: z.string().optional(),
});

export const GET = createHandler({
  auth: "admin",
  query: auditLogsQuery,
  handler: async (ctx) => {
    const where: Prisma.AuditLogWhereInput = {};
    if (ctx.query.action) where.action = ctx.query.action;
    if (ctx.query.actor_type) where.actorType = ctx.query.actor_type;
    if (ctx.query.actor_id) where.actorId = ctx.query.actor_id;
    if (ctx.query.entity_type) where.entityType = ctx.query.entity_type;
    if (ctx.query.entity_id) where.entityId = ctx.query.entity_id;
    if (ctx.query.merchant_id) where.merchantId = ctx.query.merchant_id;

    const skip = paginationSkip(ctx.query);
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
      }),
    ]);

    return NextResponse.json({
      data: logs.map(serializeAuditLog),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
