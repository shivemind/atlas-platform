import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "../../../../../../../lib/handler";
import { NotFoundError } from "../../../../../../../lib/errors";
import { prisma } from "../../../../../../../lib/prisma";
import { emitDomainEvent } from "../../../../../../../lib/events";

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

async function findOwner(profileId: string, ownerId: string) {
  const owner = await prisma.owner.findFirst({
    where: { id: ownerId, onboardingProfileId: profileId },
  });
  if (!owner) {
    throw new NotFoundError("OWNER_NOT_FOUND", "Owner not found.");
  }
  return owner;
}

export const GET = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const owner = await findOwner(ctx.params.id, ctx.params.ownerId);
    return NextResponse.json({ data: serializeOwner(owner) });
  },
});

const patchSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(320).optional(),
  ownership_percentage: z.number().int().min(0).max(100).optional(),
  title: z.string().min(1).max(200).optional(),
});

export const PATCH = createHandler({
  auth: "admin",
  validate: patchSchema,
  handler: async (ctx) => {
    const existing = await findOwner(ctx.params.id, ctx.params.ownerId);

    const profile = await prisma.onboardingProfile.findUnique({
      where: { id: ctx.params.id },
    });

    const owner = await prisma.$transaction(async (tx) => {
      const updated = await tx.owner.update({
        where: { id: ctx.params.ownerId },
        data: {
          ...(ctx.body.first_name !== undefined && { firstName: ctx.body.first_name }),
          ...(ctx.body.last_name !== undefined && { lastName: ctx.body.last_name }),
          ...(ctx.body.email !== undefined && { email: ctx.body.email }),
          ...(ctx.body.ownership_percentage !== undefined && { ownershipPercentage: ctx.body.ownership_percentage }),
          ...(ctx.body.title !== undefined && { title: ctx.body.title }),
        },
      });

      await emitDomainEvent(tx, {
        merchantId: profile!.merchantId,
        type: "onboarding.owner.updated",
        entityType: "Owner",
        entityId: updated.id,
        payload: serializeOwner(updated) as unknown as Record<string, unknown>,
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });

      return updated;
    });

    return NextResponse.json({ data: serializeOwner(owner) });
  },
});

export const DELETE = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const existing = await findOwner(ctx.params.id, ctx.params.ownerId);

    const profile = await prisma.onboardingProfile.findUnique({
      where: { id: ctx.params.id },
    });

    await prisma.$transaction(async (tx) => {
      await tx.owner.delete({ where: { id: ctx.params.ownerId } });

      await emitDomainEvent(tx, {
        merchantId: profile!.merchantId,
        type: "onboarding.owner.deleted",
        entityType: "Owner",
        entityId: existing.id,
        payload: { id: existing.id },
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });
    });

    return NextResponse.json({ data: { id: existing.id, deleted: true } });
  },
});
