import { NextResponse } from "next/server";

import { createHandler } from "../../../../../../../lib/handler";
import { NotFoundError, ConflictError } from "../../../../../../../lib/errors";
import { prisma } from "../../../../../../../lib/prisma";
import { serializeDeadLetter } from "../../route";

export const POST = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const dl = await prisma.$transaction(async (tx) => {
      const existing = await tx.deadLetter.findUnique({
        where: { id: ctx.params.id },
      });
      if (!existing) {
        throw new NotFoundError(
          "DEAD_LETTER_NOT_FOUND",
          "Dead letter not found.",
        );
      }
      if (existing.status !== "PENDING") {
        throw new ConflictError(
          "INVALID_DEAD_LETTER_STATE",
          "Only pending dead letters can be reprocessed.",
        );
      }

      return tx.deadLetter.update({
        where: { id: existing.id },
        data: { status: "REPROCESSED", reprocessedAt: new Date() },
      });
    });

    return NextResponse.json({ dead_letter: serializeDeadLetter(dl) });
  },
});
