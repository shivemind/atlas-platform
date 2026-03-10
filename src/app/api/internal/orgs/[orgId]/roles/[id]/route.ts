import { NextResponse } from "next/server";
import { type Prisma } from "@prisma/client";
import { z } from "zod";

import { createHandler } from "../../../../../../../lib/handler";
import { NotFoundError, BadRequestError } from "../../../../../../../lib/errors";
import { prisma } from "../../../../../../../lib/prisma";

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

export const GET = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const role = await prisma.role.findFirst({
      where: { id: ctx.params.id, orgId: ctx.params.orgId },
    });
    if (!role) {
      throw new NotFoundError("ROLE_NOT_FOUND", "Role not found.");
    }
    return NextResponse.json({ data: serializeRole(role) });
  },
});

const updateRoleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  permissions: z.record(z.string(), z.boolean()).optional(),
});

export const PATCH = createHandler({
  auth: "admin",
  validate: updateRoleSchema,
  handler: async (ctx) => {
    const role = await prisma.role.findFirst({
      where: { id: ctx.params.id, orgId: ctx.params.orgId },
    });
    if (!role) {
      throw new NotFoundError("ROLE_NOT_FOUND", "Role not found.");
    }
    if (role.isSystem) {
      throw new BadRequestError("SYSTEM_ROLE_IMMUTABLE", "System roles cannot be modified.");
    }

    const data: Prisma.RoleUpdateInput = {};
    if (ctx.body.name !== undefined) data.name = ctx.body.name;
    if (ctx.body.description !== undefined) data.description = ctx.body.description;
    if (ctx.body.permissions !== undefined)
      data.permissions = ctx.body.permissions as Prisma.InputJsonValue;

    const updated = await prisma.role.update({
      where: { id: ctx.params.id },
      data,
    });

    return NextResponse.json({ data: serializeRole(updated) });
  },
});

export const DELETE = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const role = await prisma.role.findFirst({
      where: { id: ctx.params.id, orgId: ctx.params.orgId },
    });
    if (!role) {
      throw new NotFoundError("ROLE_NOT_FOUND", "Role not found.");
    }
    if (role.isSystem) {
      throw new BadRequestError("SYSTEM_ROLE_UNDELETABLE", "System roles cannot be deleted.");
    }

    await prisma.role.delete({ where: { id: ctx.params.id } });

    return NextResponse.json({ data: { id: ctx.params.id, deleted: true } });
  },
});
