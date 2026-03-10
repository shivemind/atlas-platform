import { NextResponse } from "next/server";

import { createHandler } from "../../../../../lib/handler";
import { NotFoundError } from "../../../../../lib/errors";
import { prisma } from "../../../../../lib/prisma";
import { serializeEvent } from "../../../../../lib/serializers";

export const GET = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const event = await prisma.event.findUnique({
      where: { id: ctx.params.id },
    });
    if (!event) {
      throw new NotFoundError("EVENT_NOT_FOUND", "Event not found.");
    }
    return NextResponse.json({ event: serializeEvent(event) });
  },
});
