import { NextResponse } from "next/server";

import { createHandler } from "../../../../../lib/handler";
import { NotFoundError } from "../../../../../lib/errors";
import { prisma } from "../../../../../lib/prisma";
import { serializeWebhookDelivery } from "../../../../../lib/serializers";

export const GET = createHandler({
  auth: "merchant",
  handler: async (ctx) => {
    const delivery = await prisma.webhookDelivery.findFirst({
      where: { id: ctx.params.id, merchantId: ctx.merchantId },
      include: {
        attempts: {
          select: {
            attemptNumber: true,
            responseStatus: true,
            createdAt: true,
            completedAt: true,
          },
          orderBy: { attemptNumber: "asc" },
        },
      },
    });
    if (!delivery) {
      throw new NotFoundError(
        "WEBHOOK_DELIVERY_NOT_FOUND",
        "Webhook delivery not found.",
      );
    }
    return NextResponse.json({
      webhook_delivery: serializeWebhookDelivery(delivery),
    });
  },
});
