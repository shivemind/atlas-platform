import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createHandler,
  paginationSchema,
  paginationMeta,
  paginationSkip,
} from "../../../../../../../lib/handler";
import { NotFoundError } from "../../../../../../../lib/errors";
import { prisma } from "../../../../../../../lib/prisma";
import { emitDomainEvent } from "../../../../../../../lib/events";

function serializeDecision(d: {
  id: string;
  underwritingCaseId: string;
  result: string;
  reason: string | null;
  decidedBy: string | null;
  decidedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: d.id,
    underwriting_case_id: d.underwritingCaseId,
    result: d.result.toLowerCase(),
    reason: d.reason,
    decided_by: d.decidedBy,
    decided_at: d.decidedAt.toISOString(),
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
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

const DECISION_RESULTS = ["APPROVED", "DENIED", "ESCALATED", "PENDING_INFO"] as const;

const createDecisionSchema = z.object({
  result: z.enum(DECISION_RESULTS),
  reason: z.string().max(5000).optional(),
  decided_by: z.string().min(1).max(200).optional(),
});

export const POST = createHandler({
  auth: "admin",
  validate: createDecisionSchema,
  handler: async (ctx) => {
    const uwCase = await findCase(ctx.params.id);

    const decision = await prisma.$transaction(async (tx) => {
      const d = await tx.underwritingDecision.create({
        data: {
          underwritingCaseId: uwCase.id,
          result: ctx.body.result,
          reason: ctx.body.reason,
          decidedBy: ctx.body.decided_by,
        },
      });

      if (ctx.body.result === "APPROVED" || ctx.body.result === "DENIED") {
        await tx.underwritingCase.update({
          where: { id: uwCase.id },
          data: { status: ctx.body.result.toLowerCase() },
        });
      }

      await emitDomainEvent(tx, {
        merchantId: uwCase.onboardingProfile.merchantId,
        type: `underwriting.decision.${ctx.body.result.toLowerCase()}`,
        entityType: "UnderwritingDecision",
        entityId: d.id,
        payload: serializeDecision(d) as unknown as Record<string, unknown>,
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });

      return d;
    });

    return NextResponse.json({ data: serializeDecision(decision) }, { status: 201 });
  },
});

export const GET = createHandler({
  auth: "admin",
  query: paginationSchema,
  handler: async (ctx) => {
    await findCase(ctx.params.id);

    const where = { underwritingCaseId: ctx.params.id };
    const skip = paginationSkip(ctx.query);

    const [total, decisions] = await Promise.all([
      prisma.underwritingDecision.count({ where }),
      prisma.underwritingDecision.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
      }),
    ]);

    return NextResponse.json({
      data: decisions.map(serializeDecision),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
