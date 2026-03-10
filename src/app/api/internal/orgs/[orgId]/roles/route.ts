import { NextResponse } from "next/server";
import { type Prisma } from "@prisma/client";
import { z } from "zod";

import {
  createHandler,
  paginationSchema,
  paginationMeta,
  paginationSkip,
} from "../../../../../../lib/handler";
import { NotFoundError, ConflictError } from "../../../../../../lib/errors";
import { prisma } from "../../../../../../lib/prisma";

function serializeRole(r: {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  permissions: Prisma.JsonValue;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    org_id: r.orgId,
    name: r.name,
    description: r.description,
    permissions: r.permissions,
    is_system: r.isSystem,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}

const createRoleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  permissions: z.record(z.string(), z.boolean()),
  is_system: z.boolean().default(false),
});

export const POST = createHandler({
  auth: "admin",
  validate: createRoleSchema,
  handler: async (ctx) => {
    const org = await prisma.org.findUnique({ where: { id: ctx.params.orgId } });
    if (!org) {
      throw new NotFoundError("ORG_NOT_FOUND", "Organization not found.");
    }

    const existing = await prisma.role.findUnique({
      where: { orgId_name: { orgId: ctx.params.orgId, name: ctx.body.name } },
    });
    if (existing) {
      throw new ConflictError("ROLE_NAME_CONFLICT", "A role with this name already exists in this organization.");
    }

    const role = await prisma.role.create({
      data: {
        orgId: ctx.params.orgId,
        name: ctx.body.name,
        description: ctx.body.description,
        permissions: ctx.body.permissions as Prisma.InputJsonValue,
        isSystem: ctx.body.is_system,
      },
    });

    return NextResponse.json({ data: serializeRole(role) }, { status: 201 });
  },
});

export const GET = createHandler({
  auth: "admin",
  query: paginationSchema,
  handler: async (ctx) => {
    const where: Prisma.RoleWhereInput = { orgId: ctx.params.orgId };
    const skip = paginationSkip(ctx.query);

    const [total, roles] = await Promise.all([
      prisma.role.count({ where }),
      prisma.role.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
      }),
    ]);

    return NextResponse.json({
      data: roles.map(serializeRole),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
