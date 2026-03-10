import { NextResponse } from "next/server";
import { type Prisma } from "@prisma/client";
import { z } from "zod";

import {
  createHandler,
  paginationSchema,
  paginationMeta,
  paginationSkip,
} from "../../../../../lib/handler";
import { NotFoundError } from "../../../../../lib/errors";
import { prisma } from "../../../../../lib/prisma";
import { emitDomainEvent } from "../../../../../lib/events";

function serializeCase(c: {
  id: string;
  onboardingProfileId: string;
  assignedTo: string | null;
  riskScore: number | null;
  notes: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: c.id,
    onboarding_profile_id: c.onboardingProfileId,
    assigned_to: c.assignedTo,
    risk_score: c.riskScore,
    notes: c.notes,
    status: c.status,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  };
}

const createCaseSchema = z.object({
  onboarding_profile_id: z.string().min(1),
  assigned_to: z.string().min(1).max(200).optional(),
  risk_score: z.number().int().min(0).max(1000).optional(),
  notes: z.string().max(5000).optional(),
});

export const POST = createHandler({
  auth: "admin",
  validate: createCaseSchema,
  handler: async (ctx) => {
    const profile = await prisma.onboardingProfile.findUnique({
      where: { id: ctx.body.onboarding_profile_id },
    });
    if (!profile) {
      throw new NotFoundError(
        "ONBOARDING_PROFILE_NOT_FOUND",
        "Onboarding profile not found.",
      );
    }

    const uwCase = await prisma.$transaction(async (tx) => {
      const c = await tx.underwritingCase.create({
        data: {
          onboardingProfileId: ctx.body.onboarding_profile_id,
          assignedTo: ctx.body.assigned_to,
          riskScore: ctx.body.risk_score,
          notes: ctx.body.notes,
        },
      });

      await emitDomainEvent(tx, {
        merchantId: profile.merchantId,
        type: "underwriting.case.created",
        entityType: "UnderwritingCase",
        entityId: c.id,
        payload: serializeCase(c) as unknown as Record<string, unknown>,
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });

      return c;
    });

    return NextResponse.json({ data: serializeCase(uwCase) }, { status: 201 });
  },
});

const listQuery = paginationSchema.extend({
  status: z.string().optional(),
  onboarding_profile_id: z.string().optional(),
});

export const GET = createHandler({
  auth: "admin",
  query: listQuery,
  handler: async (ctx) => {
    const where: Prisma.UnderwritingCaseWhereInput = {};
    if (ctx.query.status) where.status = ctx.query.status;
    if (ctx.query.onboarding_profile_id) {
      where.onboardingProfileId = ctx.query.onboarding_profile_id;
    }

    const skip = paginationSkip(ctx.query);
    const [total, cases] = await Promise.all([
      prisma.underwritingCase.count({ where }),
      prisma.underwritingCase.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
      }),
    ]);

    return NextResponse.json({
      data: cases.map(serializeCase),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
