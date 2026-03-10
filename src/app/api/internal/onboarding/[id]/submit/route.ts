import { NextResponse } from "next/server";
import { type Prisma } from "@prisma/client";

import { createHandler } from "../../../../../../lib/handler";
import { NotFoundError, BadRequestError } from "../../../../../../lib/errors";
import { prisma } from "../../../../../../lib/prisma";
import { emitDomainEvent } from "../../../../../../lib/events";
import { defineTransitions } from "../../../../../../lib/state-machine";

type OnboardingStatus = "STARTED" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "DENIED" | "WITHDRAWN";

const onboardingMachine = defineTransitions<OnboardingStatus>({
  STARTED: ["SUBMITTED", "WITHDRAWN"],
  SUBMITTED: ["UNDER_REVIEW", "WITHDRAWN"],
  UNDER_REVIEW: ["APPROVED", "DENIED"],
});

function serializeProfile(p: {
  id: string;
  merchantId: string;
  businessName: string | null;
  businessType: string | null;
  taxId: string | null;
  website: string | null;
  country: string | null;
  status: string;
  submittedAt: Date | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    merchant_id: p.merchantId,
    business_name: p.businessName,
    business_type: p.businessType,
    tax_id: p.taxId,
    website: p.website,
    country: p.country,
    status: p.status.toLowerCase(),
    submitted_at: p.submittedAt?.toISOString() ?? null,
    metadata: p.metadata,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
}

export const POST = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const existing = await prisma.onboardingProfile.findUnique({
      where: { id: ctx.params.id },
    });
    if (!existing) {
      throw new NotFoundError("ONBOARDING_PROFILE_NOT_FOUND", "Onboarding profile not found.");
    }

    onboardingMachine.assertTransition(existing.status as OnboardingStatus, "SUBMITTED");

    if (!existing.businessName || !existing.country) {
      throw new BadRequestError(
        "INCOMPLETE_PROFILE",
        "Profile must have at least business_name and country before submission.",
      );
    }

    const profile = await prisma.$transaction(async (tx) => {
      const updated = await tx.onboardingProfile.update({
        where: { id: ctx.params.id },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      });

      await emitDomainEvent(tx, {
        merchantId: updated.merchantId,
        type: "onboarding.profile.submitted",
        entityType: "OnboardingProfile",
        entityId: updated.id,
        payload: serializeProfile(updated) as unknown as Record<string, unknown>,
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });

      return updated;
    });

    return NextResponse.json({ data: serializeProfile(profile) });
  },
});
