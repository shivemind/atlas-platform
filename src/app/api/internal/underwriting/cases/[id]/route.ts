import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "../../../../../../lib/handler";
import { NotFoundError } from "../../../../../../lib/errors";
import { prisma } from "../../../../../../lib/prisma";
import { emitDomainEvent } from "../../../../../../lib/events";

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

async function findCase(id: string) {
  const c = await prisma.underwritingCase.findUnique({
    where: { id },
    include: { onboardingProfile: { select: { merchantId: true } } },
  });
  if (!c) {
    throw new NotFoundError("UNDERWRITING_CASE_NOT_FOUND", "Underwriting case not found.");
  }
  return c;
}

export const GET = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const c = await findCase(ctx.params.id);
    return NextResponse.json({ data: serializeCase(c) });
  },
});

const patchSchema = z.object({
  assigned_to: z.string().min(1).max(200).optional(),
  risk_score: z.number().int().min(0).max(1000).optional(),
  notes: z.string().max(5000).optional(),
  status: z.string().min(1).max(50).optional(),
});

export const PATCH = createHandler({
  auth: "admin",
  validate: patchSchema,
  handler: async (ctx) => {
    const existing = await findCase(ctx.params.id);

    const uwCase = await prisma.$transaction(async (tx) => {
      const updated = await tx.underwritingCase.update({
        where: { id: ctx.params.id },
        data: {
          ...(ctx.body.assigned_to !== undefined && { assignedTo: ctx.body.assigned_to }),
          ...(ctx.body.risk_score !== undefined && { riskScore: ctx.body.risk_score }),
          ...(ctx.body.notes !== undefined && { notes: ctx.body.notes }),
          ...(ctx.body.status !== undefined && { status: ctx.body.status }),
        },
      });

      await emitDomainEvent(tx, {
        merchantId: existing.onboardingProfile.merchantId,
        type: "underwriting.case.updated",
        entityType: "UnderwritingCase",
        entityId: updated.id,
        payload: serializeCase(updated) as unknown as Record<string, unknown>,
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });

      return updated;
    });

    return NextResponse.json({ data: serializeCase(uwCase) });
  },
});
