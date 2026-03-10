import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "../../../../../../../lib/handler";
import { NotFoundError } from "../../../../../../../lib/errors";
import { prisma } from "../../../../../../../lib/prisma";
import { emitDomainEvent } from "../../../../../../../lib/events";

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

async function findDocument(profileId: string, docId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: docId, onboardingProfileId: profileId },
  });
  if (!doc) {
    throw new NotFoundError("DOCUMENT_NOT_FOUND", "Document not found.");
  }
  return doc;
}

export const GET = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const doc = await findDocument(ctx.params.id, ctx.params.docId);
    return NextResponse.json({ data: serializeDocument(doc) });
  },
});

const patchSchema = z.object({
  status: z.enum(["VERIFIED", "REJECTED"]).optional(),
  review_note: z.string().max(2000).optional(),
});

export const PATCH = createHandler({
  auth: "admin",
  validate: patchSchema,
  handler: async (ctx) => {
    await findDocument(ctx.params.id, ctx.params.docId);

    const profile = await prisma.onboardingProfile.findUnique({
      where: { id: ctx.params.id },
    });

    const doc = await prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {};
      if (ctx.body.status !== undefined) {
        data.status = ctx.body.status;
        data.reviewedAt = new Date();
      }
      if (ctx.body.review_note !== undefined) data.reviewNote = ctx.body.review_note;

      const updated = await tx.document.update({
        where: { id: ctx.params.docId },
        data,
      });

      const eventType = ctx.body.status
        ? `onboarding.document.${ctx.body.status.toLowerCase()}`
        : "onboarding.document.updated";

      await emitDomainEvent(tx, {
        merchantId: profile!.merchantId,
        type: eventType,
        entityType: "Document",
        entityId: updated.id,
        payload: serializeDocument(updated) as unknown as Record<string, unknown>,
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });

      return updated;
    });

    return NextResponse.json({ data: serializeDocument(doc) });
  },
});
