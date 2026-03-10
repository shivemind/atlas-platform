import { NextResponse } from "next/server";
import { type Prisma } from "@prisma/client";
import { z } from "zod";

import {
  createHandler,
  paginationSchema,
  paginationMeta,
  paginationSkip,
} from "../../../../lib/handler";
import { ConflictError } from "../../../../lib/errors";
import { prisma } from "../../../../lib/prisma";
import { emitDomainEvent } from "../../../../lib/events";

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

const createProfileSchema = z.object({
  merchant_id: z.string().min(1),
  business_name: z.string().min(1).max(300).optional(),
  business_type: z.string().min(1).max(100).optional(),
  tax_id: z.string().min(1).max(100).optional(),
  website: z.string().url().max(500).optional(),
  country: z.string().length(2).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const POST = createHandler({
  auth: "admin",
  validate: createProfileSchema,
  handler: async (ctx) => {
    const existing = await prisma.onboardingProfile.findUnique({
      where: { merchantId: ctx.body.merchant_id },
    });
    if (existing) {
      throw new ConflictError(
        "ONBOARDING_PROFILE_EXISTS",
        "An onboarding profile already exists for this merchant.",
      );
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: ctx.body.merchant_id },
    });
    if (!merchant) {
      throw new ConflictError(
        "MERCHANT_NOT_FOUND",
        "Merchant not found.",
      );
    }

    const profile = await prisma.$transaction(async (tx) => {
      const p = await tx.onboardingProfile.create({
        data: {
          merchantId: ctx.body.merchant_id,
          businessName: ctx.body.business_name,
          businessType: ctx.body.business_type,
          taxId: ctx.body.tax_id,
          website: ctx.body.website,
          country: ctx.body.country,
          metadata: ctx.body.metadata as Prisma.InputJsonValue | undefined,
        },
      });

      await emitDomainEvent(tx, {
        merchantId: ctx.body.merchant_id,
        type: "onboarding.profile.created",
        entityType: "OnboardingProfile",
        entityId: p.id,
        payload: serializeProfile(p) as unknown as Record<string, unknown>,
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });

      return p;
    });

    return NextResponse.json({ data: serializeProfile(profile) }, { status: 201 });
  },
});

const listQuery = paginationSchema.extend({
  status: z.enum(["STARTED", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "DENIED", "WITHDRAWN"]).optional(),
});

export const GET = createHandler({
  auth: "admin",
  query: listQuery,
  handler: async (ctx) => {
    const where: Prisma.OnboardingProfileWhereInput = {};
    if (ctx.query.status) where.status = ctx.query.status;

    const skip = paginationSkip(ctx.query);
    const [total, profiles] = await Promise.all([
      prisma.onboardingProfile.count({ where }),
      prisma.onboardingProfile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
      }),
    ]);

    return NextResponse.json({
      data: profiles.map(serializeProfile),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
