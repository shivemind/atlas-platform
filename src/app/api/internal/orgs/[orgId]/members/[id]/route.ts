import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "../../../../../../../lib/handler";
import { NotFoundError } from "../../../../../../../lib/errors";
import { prisma } from "../../../../../../../lib/prisma";

function serializeMember(m: {
  id: string;
  orgId: string;
  merchantId: string;
  role: string;
  invitedBy: string | null;
  invitedAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: m.id,
    org_id: m.orgId,
    merchant_id: m.merchantId,
    role: m.role,
    invited_by: m.invitedBy,
    invited_at: m.invitedAt.toISOString(),
    accepted_at: m.acceptedAt?.toISOString() ?? null,
    created_at: m.createdAt.toISOString(),
    updated_at: m.updatedAt.toISOString(),
  };
}

export const GET = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const member = await prisma.orgMember.findFirst({
      where: { id: ctx.params.id, orgId: ctx.params.orgId },
    });
    if (!member) {
      throw new NotFoundError("MEMBER_NOT_FOUND", "Organization member not found.");
    }
    return NextResponse.json({ data: serializeMember(member) });
  },
});

const updateMemberSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
});

export const PATCH = createHandler({
  auth: "admin",
  validate: updateMemberSchema,
  handler: async (ctx) => {
    const member = await prisma.orgMember.findFirst({
      where: { id: ctx.params.id, orgId: ctx.params.orgId },
    });
    if (!member) {
      throw new NotFoundError("MEMBER_NOT_FOUND", "Organization member not found.");
    }

    const updated = await prisma.orgMember.update({
      where: { id: ctx.params.id },
      data: { role: ctx.body.role },
    });

    return NextResponse.json({ data: serializeMember(updated) });
  },
});

export const DELETE = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const member = await prisma.orgMember.findFirst({
      where: { id: ctx.params.id, orgId: ctx.params.orgId },
    });
    if (!member) {
      throw new NotFoundError("MEMBER_NOT_FOUND", "Organization member not found.");
    }

    await prisma.orgMember.delete({ where: { id: ctx.params.id } });

    return NextResponse.json({ data: { id: ctx.params.id, deleted: true } });
  },
});
