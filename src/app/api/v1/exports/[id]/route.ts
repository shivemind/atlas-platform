import { NextResponse } from "next/server";

import { createHandler } from "../../../../../lib/handler";
import { NotFoundError } from "../../../../../lib/errors";
import { prisma } from "../../../../../lib/prisma";
import { serializeExport } from "../route";

export const GET = createHandler({
  auth: "merchant",
  handler: async (ctx) => {
    const exp = await prisma.export.findFirst({
      where: { id: ctx.params.id, merchantId: ctx.merchantId },
    });
    if (!exp) {
      throw new NotFoundError("EXPORT_NOT_FOUND", "Export not found.");
    }

    return NextResponse.json({ export: serializeExport(exp) });
  },
});
