import { NextResponse } from "next/server";
import { type Prisma } from "@prisma/client";
import { z } from "zod";

import { createHandler } from "../../../../../lib/handler";
import { NotFoundError, BadRequestError } from "../../../../../lib/errors";
import { prisma } from "../../../../../lib/prisma";
import { emitDomainEvent } from "../../../../../lib/events";
import { defineTransitions } from "../../../../../lib/state-machine";

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

export const GET = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const profile = await prisma.onboardingProfile.findUnique({
      where: { id: ctx.params.id },
    });
    if (!profile) {
      throw new NotFoundError("ONBOARDING_PROFILE_NOT_FOUND", "Onboarding profile not found.");
    }
    return NextResponse.json({ data: serializeProfile(profile) });
  },
});

const patchSchema = z.object({
  business_name: z.string().min(1).max(300).optional(),
  business_type: z.string().min(1).max(100).optional(),
  tax_id: z.string().min(1).max(100).optional(),
  website: z.string().url().max(500).optional(),
  country: z.string().length(2).optional(),
  status: z.enum(["STARTED", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "DENIED", "WITHDRAWN"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const PATCH = createHandler({
  auth: "admin",
  validate: patchSchema,
  handler: async (ctx) => {
    const existing = await prisma.onboardingProfile.findUnique({
      where: { id: ctx.params.id },
    });
    if (!existing) {
      throw new NotFoundError("ONBOARDING_PROFILE_NOT_FOUND", "Onboarding profile not found.");
    }

    if (ctx.body.status) {
      onboardingMachine.assertTransition(
        existing.status as OnboardingStatus,
        ctx.body.status as OnboardingStatus,
      );
    }

    const profile = await prisma.$transaction(async (tx) => {
      const data: Prisma.OnboardingProfileUpdateInput = {};
      if (ctx.body.business_name !== undefined) data.businessName = ctx.body.business_name;
      if (ctx.body.business_type !== undefined) data.businessType = ctx.body.business_type;
      if (ctx.body.tax_id !== undefined) data.taxId = ctx.body.tax_id;
      if (ctx.body.website !== undefined) data.website = ctx.body.website;
      if (ctx.body.country !== undefined) data.country = ctx.body.country;
      if (ctx.body.metadata !== undefined) data.metadata = ctx.body.metadata as Prisma.InputJsonValue;
      if (ctx.body.status !== undefined) data.status = ctx.body.status as OnboardingStatus;

      const updated = await tx.onboardingProfile.update({
        where: { id: ctx.params.id },
        data,
      });

      const eventType = ctx.body.status
        ? `onboarding.profile.${ctx.body.status.toLowerCase()}`
        : "onboarding.profile.updated";

      await emitDomainEvent(tx, {
        merchantId: updated.merchantId,
        type: eventType,
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

export const DELETE = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const existing = await prisma.onboardingProfile.findUnique({
      where: { id: ctx.params.id },
    });
    if (!existing) {
      throw new NotFoundError("ONBOARDING_PROFILE_NOT_FOUND", "Onboarding profile not found.");
    }

    if (onboardingMachine.isTerminal(existing.status as OnboardingStatus)) {
      throw new BadRequestError(
        "CANNOT_DELETE_TERMINAL",
        "Cannot delete a profile in a terminal state.",
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.onboardingProfile.delete({ where: { id: ctx.params.id } });

      await emitDomainEvent(tx, {
        merchantId: existing.merchantId,
        type: "onboarding.profile.deleted",
        entityType: "OnboardingProfile",
        entityId: existing.id,
        payload: { id: existing.id },
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });
    });

    return NextResponse.json({ data: { id: existing.id, deleted: true } });
  },
});
