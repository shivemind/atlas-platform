import { NextResponse } from "next/server";
import { type Prisma } from "@prisma/client";
import { z } from "zod";

import { createHandler } from "../../../../../lib/handler";
import { NotFoundError, ConflictError } from "../../../../../lib/errors";
import { prisma } from "../../../../../lib/prisma";

function serializeOrg(org: {
  id: string;
  name: string;
  slug: string;
  status: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    status: org.status,
    metadata: org.metadata,
    created_at: org.createdAt.toISOString(),
    updated_at: org.updatedAt.toISOString(),
  };
}

export const GET = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const org = await prisma.org.findUnique({
      where: { id: ctx.params.orgId },
    });
    if (!org) {
      throw new NotFoundError("ORG_NOT_FOUND", "Organization not found.");
    }
    return NextResponse.json({ data: serializeOrg(org) });
  },
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const PATCH = createHandler({
  auth: "admin",
  validate: updateOrgSchema,
  handler: async (ctx) => {
    const org = await prisma.org.findUnique({
      where: { id: ctx.params.orgId },
    });
    if (!org) {
      throw new NotFoundError("ORG_NOT_FOUND", "Organization not found.");
    }

    const data: Prisma.OrgUpdateInput = {};
    if (ctx.body.name !== undefined) data.name = ctx.body.name;
    if (ctx.body.status !== undefined) data.status = ctx.body.status;
    if (ctx.body.metadata !== undefined)
      data.metadata = ctx.body.metadata as Prisma.InputJsonValue;

    const updated = await prisma.org.update({
      where: { id: ctx.params.orgId },
      data,
    });

    return NextResponse.json({ data: serializeOrg(updated) });
  },
});

export const DELETE = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const org = await prisma.org.findUnique({
      where: { id: ctx.params.orgId },
    });
    if (!org) {
      throw new NotFoundError("ORG_NOT_FOUND", "Organization not found.");
    }
    if (org.status === "ARCHIVED") {
      throw new ConflictError("ORG_ALREADY_ARCHIVED", "Organization is already archived.");
    }

    const archived = await prisma.org.update({
      where: { id: ctx.params.orgId },
      data: { status: "ARCHIVED" },
    });

    return NextResponse.json({ data: serializeOrg(archived) });
  },
});
