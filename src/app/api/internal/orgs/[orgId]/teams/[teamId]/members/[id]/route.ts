import { NextResponse } from "next/server";

import { createHandler } from "../../../../../../../../../lib/handler";
import { NotFoundError } from "../../../../../../../../../lib/errors";
import { prisma } from "../../../../../../../../../lib/prisma";

export const DELETE = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const team = await prisma.team.findFirst({
      where: { id: ctx.params.teamId, orgId: ctx.params.orgId },
    });
    if (!team) {
      throw new NotFoundError("TEAM_NOT_FOUND", "Team not found.");
    }

    const teamMember = await prisma.teamMember.findFirst({
      where: { id: ctx.params.id, teamId: ctx.params.teamId },
    });
    if (!teamMember) {
      throw new NotFoundError("TEAM_MEMBER_NOT_FOUND", "Team member not found.");
    }

    await prisma.teamMember.delete({ where: { id: ctx.params.id } });

    return NextResponse.json({ data: { id: ctx.params.id, deleted: true } });
  },
});
