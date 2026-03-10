import { NextResponse } from "next/server";

import { createHandler } from "../../../../../../lib/handler";
import { NotFoundError, ConflictError } from "../../../../../../lib/errors";
import { emitDomainEvent } from "../../../../../../lib/events";
import { prisma } from "../../../../../../lib/prisma";
import { serializeExport } from "../../route";

export const POST = createHandler({
  auth: "merchant",
  handler: async (ctx) => {
    const exp = await prisma.$transaction(async (tx) => {
      const existing = await tx.export.findFirst({
        where: { id: ctx.params.id, merchantId: ctx.merchantId },
      });
      if (!existing) {
        throw new NotFoundError("EXPORT_NOT_FOUND", "Export not found.");
      }
      if (existing.status !== "QUEUED") {
        throw new ConflictError(
          "INVALID_EXPORT_STATE",
          "Only queued exports can be canceled.",
        );
      }

      const updated = await tx.export.update({
        where: { id: existing.id },
        data: { status: "FAILED", errorMessage: "Canceled by user." },
      });

      await emitDomainEvent(tx, {
        merchantId: ctx.merchantId,
        type: "export.canceled",
        entityType: "Export",
        entityId: updated.id,
        payload: serializeExport(updated) as Record<string, unknown>,
        actorType: "api_key",
        actorId: ctx.apiKey.id,
      });

      return updated;
    });

    return NextResponse.json({ export: serializeExport(exp) });
  },
});
