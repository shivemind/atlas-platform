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

function serializeDocument(d: {
  id: string;
  onboardingProfileId: string;
  type: string;
  status: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: d.id,
    onboarding_profile_id: d.onboardingProfileId,
    type: d.type.toLowerCase(),
    status: d.status.toLowerCase(),
    file_name: d.fileName,
    file_size: d.fileSize,
    mime_type: d.mimeType,
    review_note: d.reviewNote,
    reviewed_at: d.reviewedAt?.toISOString() ?? null,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
  };
}

async function ensureProfile(id: string) {
  const profile = await prisma.onboardingProfile.findUnique({ where: { id } });
  if (!profile) {
    throw new NotFoundError("ONBOARDING_PROFILE_NOT_FOUND", "Onboarding profile not found.");
  }
  return profile;
}

const DOCUMENT_TYPES = [
  "GOVERNMENT_ID",
  "PROOF_OF_ADDRESS",
  "BANK_STATEMENT",
  "TAX_RETURN",
  "ARTICLES_OF_INCORPORATION",
  "OTHER",
] as const;

const createDocSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  file_name: z.string().min(1).max(500),
  file_size: z.number().int().positive().optional(),
  mime_type: z.string().min(1).max(200).optional(),
});

export const POST = createHandler({
  auth: "admin",
  validate: createDocSchema,
  handler: async (ctx) => {
    const profile = await ensureProfile(ctx.params.id);

    const doc = await prisma.$transaction(async (tx) => {
      const d = await tx.document.create({
        data: {
          onboardingProfileId: profile.id,
          type: ctx.body.type,
          fileName: ctx.body.file_name,
          fileSize: ctx.body.file_size,
          mimeType: ctx.body.mime_type,
        },
      });

      await emitDomainEvent(tx, {
        merchantId: profile.merchantId,
        type: "onboarding.document.created",
        entityType: "Document",
        entityId: d.id,
        payload: serializeDocument(d) as unknown as Record<string, unknown>,
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });

      return d;
    });

    return NextResponse.json({ data: serializeDocument(doc) }, { status: 201 });
  },
});

const listQuery = paginationSchema.extend({
  status: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
});

export const GET = createHandler({
  auth: "admin",
  query: listQuery,
  handler: async (ctx) => {
    await ensureProfile(ctx.params.id);

    const where: Record<string, unknown> = {
      onboardingProfileId: ctx.params.id,
    };
    if (ctx.query.status) where.status = ctx.query.status;

    const skip = paginationSkip(ctx.query);
    const [total, docs] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: ctx.query.pageSize,
      }),
    ]);

    return NextResponse.json({
      data: docs.map(serializeDocument),
      pagination: paginationMeta(ctx.query, total),
    });
  },
});
