import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createHandler,
  paginationSchema,
  paginationMeta,
  paginationSkip,
} from "../../../../../../lib/handler";
import { NotFoundError } from "../../../../../../lib/errors";
import { prisma } from "../../../../../../lib/prisma";
import { emitDomainEvent } from "../../../../../../lib/events";

function serializeOwner(o: {
  id: string;
  onboardingProfileId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  ownershipPercentage: number | null;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: o.id,
    onboarding_profile_id: o.onboardingProfileId,
    first_name: o.firstName,
    last_name: o.lastName,
    email: o.email,
    ownership_percentage: o.ownershipPercentage,
    title: o.title,
    created_at: o.createdAt.toISOString(),
    updated_at: o.updatedAt.toISOString(),
  };
}

async function ensureProfile(id: string) {
  const profile = await prisma.onboardingProfile.findUnique({ where: { id } });
  if (!profile) {
    throw new NotFoundError("ONBOARDING_PROFILE_NOT_FOUND", "Onboarding profile not found.");
  }
  return profile;
}

const createOwnerSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email().max(320).optional(),
  ownership_percentage: z.number().int().min(0).max(100).optional(),
  title: z.string().min(1).max(200).optional(),
});

export const POST = createHandler({
  auth: "admin",
  validate: createOwnerSchema,
  handler: async (ctx) => {
    const profile = await ensureProfile(ctx.params.id);

    const owner = await prisma.$transaction(async (tx) => {
      const o = await tx.owner.create({
        data: {
          onboardingProfileId: profile.id,
          firstName: ctx.body.first_name,
          lastName: ctx.body.last_name,
          email: ctx.body.email,
          ownershipPercentage: ctx.body.ownership_percentage,
          title: ctx.body.title,
        },
      });

      await emitDomainEvent(tx, {
        merchantId: profile.merchantId,
        type: "onboarding.owner.created",
        entityType: "Owner",
        entityId: o.id,
        payload: serializeOwner(o) as unknown as Record<string, unknown>,
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });

      return o;
    });

    return NextResponse.json({ data: serializeOwner(owner) }, { status: 201 });
  },
});

export const GET = createHandler({
  auth: "admin",
  query: paginationSchema,
  handler: async (ctx) => {
    await ensureProfile(ctx.params.id);

    const where = { onboardingProfileId: ctx.params.id };
    const skip = paginationSkip(ctx.query);

    const [total, owners] = await Promise.all([
      prisma.owner.count({ where }),
      prisma.owner.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
      }),
    ]);

    return NextResponse.json({
      data: owners.map(serializeOwner),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
