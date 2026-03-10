import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "../../../../../../../lib/handler";
import { NotFoundError } from "../../../../../../../lib/errors";
import { prisma } from "../../../../../../../lib/prisma";
import { emitDomainEvent } from "../../../../../../../lib/events";

function serializeBankAccount(b: {
  id: string;
  onboardingProfileId: string;
  bankName: string;
  accountHolderName: string;
  routingNumber: string;
  accountNumberLast4: string;
  accountType: string;
  isVerified: boolean;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: b.id,
    onboarding_profile_id: b.onboardingProfileId,
    bank_name: b.bankName,
    account_holder_name: b.accountHolderName,
    routing_number: b.routingNumber,
    account_number_last4: b.accountNumberLast4,
    account_type: b.accountType,
    is_verified: b.isVerified,
    is_primary: b.isPrimary,
    created_at: b.createdAt.toISOString(),
    updated_at: b.updatedAt.toISOString(),
  };
}

async function findBankAccount(profileId: string, baId: string) {
  const ba = await prisma.bankAccount.findFirst({
    where: { id: baId, onboardingProfileId: profileId },
  });
  if (!ba) {
    throw new NotFoundError("BANK_ACCOUNT_NOT_FOUND", "Bank account not found.");
  }
  return ba;
}

export const GET = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const ba = await findBankAccount(ctx.params.id, ctx.params.baId);
    return NextResponse.json({ data: serializeBankAccount(ba) });
  },
});

const patchSchema = z.object({
  bank_name: z.string().min(1).max(200).optional(),
  account_holder_name: z.string().min(1).max(200).optional(),
  account_type: z.enum(["checking", "savings"]).optional(),
  is_verified: z.boolean().optional(),
  is_primary: z.boolean().optional(),
});

export const PATCH = createHandler({
  auth: "admin",
  validate: patchSchema,
  handler: async (ctx) => {
    await findBankAccount(ctx.params.id, ctx.params.baId);

    const profile = await prisma.onboardingProfile.findUnique({
      where: { id: ctx.params.id },
    });

    const ba = await prisma.$transaction(async (tx) => {
      if (ctx.body.is_primary) {
        await tx.bankAccount.updateMany({
          where: { onboardingProfileId: ctx.params.id, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const updated = await tx.bankAccount.update({
        where: { id: ctx.params.baId },
        data: {
          ...(ctx.body.bank_name !== undefined && { bankName: ctx.body.bank_name }),
          ...(ctx.body.account_holder_name !== undefined && { accountHolderName: ctx.body.account_holder_name }),
          ...(ctx.body.account_type !== undefined && { accountType: ctx.body.account_type }),
          ...(ctx.body.is_verified !== undefined && { isVerified: ctx.body.is_verified }),
          ...(ctx.body.is_primary !== undefined && { isPrimary: ctx.body.is_primary }),
        },
      });

      await emitDomainEvent(tx, {
        merchantId: profile!.merchantId,
        type: "onboarding.bank_account.updated",
        entityType: "BankAccount",
        entityId: updated.id,
        payload: serializeBankAccount(updated) as unknown as Record<string, unknown>,
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });

      return updated;
    });

    return NextResponse.json({ data: serializeBankAccount(ba) });
  },
});

export const DELETE = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const existing = await findBankAccount(ctx.params.id, ctx.params.baId);

    const profile = await prisma.onboardingProfile.findUnique({
      where: { id: ctx.params.id },
    });

    await prisma.$transaction(async (tx) => {
      await tx.bankAccount.delete({ where: { id: ctx.params.baId } });

      await emitDomainEvent(tx, {
        merchantId: profile!.merchantId,
        type: "onboarding.bank_account.deleted",
        entityType: "BankAccount",
        entityId: existing.id,
        payload: { id: existing.id },
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });
    });

    return NextResponse.json({ data: { id: existing.id, deleted: true } });
  },
});
