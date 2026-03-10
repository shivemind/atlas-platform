import { NextResponse } from "next/server";
import { type Prisma } from "@prisma/client";
import { z } from "zod";

import {
  createHandler,
  paginationSchema,
  paginationMeta,
  paginationSkip,
} from "../../../../../../lib/handler";
import { NotFoundError } from "../../../../../../lib/errors";
import { prisma } from "../../../../../../lib/prisma";

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

const orgAuditLogsQuery = paginationSchema.extend({
  action: z.string().optional(),
  actor_type: z.string().optional(),
  entity_type: z.string().optional(),
});

export const GET = createHandler({
  auth: "admin",
  query: orgAuditLogsQuery,
  handler: async (ctx) => {
    const org = await prisma.org.findUnique({
      where: { id: ctx.params.orgId },
      select: { id: true, merchants: { select: { id: true } } },
    });
    if (!org) {
      throw new NotFoundError("ORG_NOT_FOUND", "Organization not found.");
    }

    const merchantIds = org.merchants.map((m) => m.id);

    const where: Prisma.AuditLogWhereInput = {
      merchantId: { in: merchantIds },
    };
    if (ctx.query.action) where.action = ctx.query.action;
    if (ctx.query.actor_type) where.actorType = ctx.query.actor_type;
    if (ctx.query.entity_type) where.entityType = ctx.query.entity_type;

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
