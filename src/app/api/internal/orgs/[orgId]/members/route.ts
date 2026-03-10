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

const addMemberSchema = z.object({
  merchant_id: z.string().min(1),
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
  invited_by: z.string().optional(),
});

export const POST = createHandler({
  auth: "admin",
  validate: addMemberSchema,
  handler: async (ctx) => {
    const org = await prisma.org.findUnique({ where: { id: ctx.params.orgId } });
    if (!org) {
      throw new NotFoundError("ORG_NOT_FOUND", "Organization not found.");
    }

    const existing = await prisma.orgMember.findUnique({
      where: { orgId_merchantId: { orgId: ctx.params.orgId, merchantId: ctx.body.merchant_id } },
    });
    if (existing) {
      throw new ConflictError("MEMBER_ALREADY_EXISTS", "Merchant is already a member of this organization.");
    }

    const member = await prisma.orgMember.create({
      data: {
        orgId: ctx.params.orgId,
        merchantId: ctx.body.merchant_id,
        role: ctx.body.role,
        invitedBy: ctx.body.invited_by,
      },
    });

    return NextResponse.json({ data: serializeMember(member) }, { status: 201 });
  },
});

const listMembersQuery = paginationSchema.extend({
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]).optional(),
});

export const GET = createHandler({
  auth: "admin",
  query: listMembersQuery,
  handler: async (ctx) => {
    const where: Prisma.OrgMemberWhereInput = { orgId: ctx.params.orgId };
    if (ctx.query.role) where.role = ctx.query.role;

    const skip = paginationSkip(ctx.query);
    const [total, members] = await Promise.all([
      prisma.orgMember.count({ where }),
      prisma.orgMember.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
      }),
    ]);

    return NextResponse.json({
      data: members.map(serializeMember),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
