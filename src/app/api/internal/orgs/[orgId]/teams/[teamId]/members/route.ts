import { NextResponse } from "next/server";
import { type Prisma } from "@prisma/client";
import { z } from "zod";

import {
  createHandler,
  paginationSchema,
  paginationMeta,
  paginationSkip,
} from "../../../../../../../../lib/handler";
import { NotFoundError, ConflictError } from "../../../../../../../../lib/errors";
import { prisma } from "../../../../../../../../lib/prisma";

function serializeTeamMember(tm: {
  id: string;
  teamId: string;
  orgMemberId: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: tm.id,
    team_id: tm.teamId,
    org_member_id: tm.orgMemberId,
    role: tm.role,
    created_at: tm.createdAt.toISOString(),
    updated_at: tm.updatedAt.toISOString(),
  };
}

const addTeamMemberSchema = z.object({
  org_member_id: z.string().min(1),
  role: z.enum(["LEAD", "MEMBER", "VIEWER"]).default("MEMBER"),
});

export const POST = createHandler({
  auth: "admin",
  validate: addTeamMemberSchema,
  handler: async (ctx) => {
    const team = await prisma.team.findFirst({
      where: { id: ctx.params.teamId, orgId: ctx.params.orgId },
    });
    if (!team) {
      throw new NotFoundError("TEAM_NOT_FOUND", "Team not found.");
    }

    const orgMember = await prisma.orgMember.findFirst({
      where: { id: ctx.body.org_member_id, orgId: ctx.params.orgId },
    });
    if (!orgMember) {
      throw new NotFoundError("ORG_MEMBER_NOT_FOUND", "Organization member not found.");
    }

    const existing = await prisma.teamMember.findUnique({
      where: {
        teamId_orgMemberId: {
          teamId: ctx.params.teamId,
          orgMemberId: ctx.body.org_member_id,
        },
      },
    });
    if (existing) {
      throw new ConflictError("TEAM_MEMBER_EXISTS", "Member is already on this team.");
    }

    const teamMember = await prisma.teamMember.create({
      data: {
        teamId: ctx.params.teamId,
        orgMemberId: ctx.body.org_member_id,
        role: ctx.body.role,
      },
    });

    return NextResponse.json({ data: serializeTeamMember(teamMember) }, { status: 201 });
  },
});

export const GET = createHandler({
  auth: "admin",
  query: paginationSchema,
  handler: async (ctx) => {
    const where: Prisma.TeamMemberWhereInput = { teamId: ctx.params.teamId };
    const skip = paginationSkip(ctx.query);

    const [total, members] = await Promise.all([
      prisma.teamMember.count({ where }),
      prisma.teamMember.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
      }),
    ]);

    return NextResponse.json({
      data: members.map(serializeTeamMember),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
