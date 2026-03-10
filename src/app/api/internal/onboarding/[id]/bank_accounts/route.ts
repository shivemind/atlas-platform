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

async function ensureProfile(id: string) {
  const profile = await prisma.onboardingProfile.findUnique({ where: { id } });
  if (!profile) {
    throw new NotFoundError("ONBOARDING_PROFILE_NOT_FOUND", "Onboarding profile not found.");
  }
  return profile;
}

const createBankAccountSchema = z.object({
  bank_name: z.string().min(1).max(200),
  account_holder_name: z.string().min(1).max(200),
  routing_number: z.string().min(1).max(50),
  account_number_last4: z.string().length(4),
  account_type: z.enum(["checking", "savings"]).default("checking"),
  is_primary: z.boolean().default(false),
});

export const POST = createHandler({
  auth: "admin",
  validate: createBankAccountSchema,
  handler: async (ctx) => {
    const profile = await ensureProfile(ctx.params.id);

    const bankAccount = await prisma.$transaction(async (tx) => {
      if (ctx.body.is_primary) {
        await tx.bankAccount.updateMany({
          where: { onboardingProfileId: profile.id, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const ba = await tx.bankAccount.create({
        data: {
          onboardingProfileId: profile.id,
          bankName: ctx.body.bank_name,
          accountHolderName: ctx.body.account_holder_name,
          routingNumber: ctx.body.routing_number,
          accountNumberLast4: ctx.body.account_number_last4,
          accountType: ctx.body.account_type,
          isPrimary: ctx.body.is_primary,
        },
      });

      await emitDomainEvent(tx, {
        merchantId: profile.merchantId,
        type: "onboarding.bank_account.created",
        entityType: "BankAccount",
        entityId: ba.id,
        payload: serializeBankAccount(ba) as unknown as Record<string, unknown>,
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });

      return ba;
    });

    return NextResponse.json({ data: serializeBankAccount(bankAccount) }, { status: 201 });
  },
});

export const GET = createHandler({
  auth: "admin",
  query: paginationSchema,
  handler: async (ctx) => {
    await ensureProfile(ctx.params.id);

    const where = { onboardingProfileId: ctx.params.id };
    const skip = paginationSkip(ctx.query);

    const [total, accounts] = await Promise.all([
      prisma.bankAccount.count({ where }),
      prisma.bankAccount.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
      }),
    ]);

    return NextResponse.json({
      data: accounts.map(serializeBankAccount),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
