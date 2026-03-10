import { NextResponse } from "next/server";

import { createHandler } from "../../../../../../lib/handler";
import { NotFoundError } from "../../../../../../lib/errors";
import { prisma } from "../../../../../../lib/prisma";
import { serializeDeadLetter } from "../route";

export const GET = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const dl = await prisma.deadLetter.findUnique({
      where: { id: ctx.params.id },
    });
    if (!dl) {
      throw new NotFoundError(
        "DEAD_LETTER_NOT_FOUND",
        "Dead letter not found.",
      );
    }

    return NextResponse.json({ dead_letter: serializeDeadLetter(dl) });
  },
});
