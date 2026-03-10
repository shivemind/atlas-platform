import { NextResponse } from "next/server";
import { type Prisma } from "@prisma/client";
import { z } from "zod";
import crypto from "crypto";

import {
  createHandler,
  paginationSchema,
  paginationMeta,
  paginationSkip,
} from "../../../../../../lib/handler";
import { NotFoundError, ConflictError } from "../../../../../../lib/errors";
import { prisma } from "../../../../../../lib/prisma";

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base}-${crypto.randomBytes(3).toString("hex")}`;
}

function serializeTeam(t: {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: t.id,
    org_id: t.orgId,
    name: t.name,
    slug: t.slug,
    description: t.description,
    created_at: t.createdAt.toISOString(),
    updated_at: t.updatedAt.toISOString(),
  };
}

const createTeamSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

export const POST = createHandler({
  auth: "admin",
  validate: createTeamSchema,
  handler: async (ctx) => {
    const org = await prisma.org.findUnique({ where: { id: ctx.params.orgId } });
    if (!org) {
      throw new NotFoundError("ORG_NOT_FOUND", "Organization not found.");
    }

    const slug = slugify(ctx.body.name);

    const existing = await prisma.team.findUnique({
      where: { orgId_slug: { orgId: ctx.params.orgId, slug } },
    });
    if (existing) {
      throw new ConflictError("TEAM_SLUG_CONFLICT", "Team slug already exists in this organization.");
    }

    const team = await prisma.team.create({
      data: {
        orgId: ctx.params.orgId,
        name: ctx.body.name,
        slug,
        description: ctx.body.description,
      },
    });

    return NextResponse.json({ data: serializeTeam(team) }, { status: 201 });
  },
});

export const GET = createHandler({
  auth: "admin",
  query: paginationSchema,
  handler: async (ctx) => {
    const where: Prisma.TeamWhereInput = { orgId: ctx.params.orgId };
    const skip = paginationSkip(ctx.query);

    const [total, teams] = await Promise.all([
      prisma.team.count({ where }),
      prisma.team.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
      }),
    ]);

    return NextResponse.json({
      data: teams.map(serializeTeam),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
