import { NextResponse } from "next/server";

import { createHandler } from "../../../../../lib/handler";
import { NotFoundError } from "../../../../../lib/errors";
import { prisma } from "../../../../../lib/prisma";
import { serializeEvent } from "../../../../../lib/serializers";

export const GET = createHandler({
  auth: "merchant",
  handler: async (ctx) => {
    const event = await prisma.event.findFirst({
      where: { id: ctx.params.id, merchantId: ctx.merchantId },
    });
    if (!event) {
      throw new NotFoundError("EVENT_NOT_FOUND", "Event not found.");
    }
    return NextResponse.json({ event: serializeEvent(event) });
  },
});
