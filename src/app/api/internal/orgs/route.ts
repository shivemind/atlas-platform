import { NextResponse } from "next/server";
import { type Prisma } from "@prisma/client";
import { z } from "zod";
import crypto from "crypto";

import {
  createHandler,
  paginationSchema,
  paginationMeta,
  paginationSkip,
} from "../../../../lib/handler";
import { ConflictError } from "../../../../lib/errors";
import { prisma } from "../../../../lib/prisma";

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base}-${crypto.randomBytes(3).toString("hex")}`;
}

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

const createOrgSchema = z.object({
  name: z.string().min(1).max(200),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const POST = createHandler({
  auth: "admin",
  validate: createOrgSchema,
  handler: async (ctx) => {
    const slug = slugify(ctx.body.name);

    const existing = await prisma.org.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictError("ORG_SLUG_CONFLICT", "Organization slug already exists.");
    }

    const org = await prisma.org.create({
      data: {
        name: ctx.body.name,
        slug,
        metadata: ctx.body.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    return NextResponse.json({ data: serializeOrg(org) }, { status: 201 });
  },
});

const listOrgsQuery = paginationSchema.extend({
  status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]).optional(),
});

export const GET = createHandler({
  auth: "admin",
  query: listOrgsQuery,
  handler: async (ctx) => {
    const where: Prisma.OrgWhereInput = {};
    if (ctx.query.status) where.status = ctx.query.status;

    const skip = paginationSkip(ctx.query);
    const [total, orgs] = await Promise.all([
      prisma.org.count({ where }),
      prisma.org.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
      }),
    ]);

    return NextResponse.json({
      data: orgs.map(serializeOrg),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
