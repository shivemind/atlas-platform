import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "../../../../../../../lib/handler";
import { NotFoundError } from "../../../../../../../lib/errors";
import { prisma } from "../../../../../../../lib/prisma";

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

export const GET = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const team = await prisma.team.findFirst({
      where: { id: ctx.params.teamId, orgId: ctx.params.orgId },
    });
    if (!team) {
      throw new NotFoundError("TEAM_NOT_FOUND", "Team not found.");
    }
    return NextResponse.json({ data: serializeTeam(team) });
  },
});

const updateTeamSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
});

export const PATCH = createHandler({
  auth: "admin",
  validate: updateTeamSchema,
  handler: async (ctx) => {
    const team = await prisma.team.findFirst({
      where: { id: ctx.params.teamId, orgId: ctx.params.orgId },
    });
    if (!team) {
      throw new NotFoundError("TEAM_NOT_FOUND", "Team not found.");
    }

    const updated = await prisma.team.update({
      where: { id: ctx.params.teamId },
      data: {
        ...(ctx.body.name !== undefined && { name: ctx.body.name }),
        ...(ctx.body.description !== undefined && { description: ctx.body.description }),
      },
    });

    return NextResponse.json({ data: serializeTeam(updated) });
  },
});

export const DELETE = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const team = await prisma.team.findFirst({
      where: { id: ctx.params.teamId, orgId: ctx.params.orgId },
    });
    if (!team) {
      throw new NotFoundError("TEAM_NOT_FOUND", "Team not found.");
    }

    await prisma.team.delete({ where: { id: ctx.params.teamId } });

    return NextResponse.json({ data: { id: ctx.params.teamId, deleted: true } });
  },
});
