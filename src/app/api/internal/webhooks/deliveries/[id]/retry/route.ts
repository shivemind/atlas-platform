import { NextResponse } from "next/server";

import { createHandler } from "../../../../../../../lib/handler";
import { NotFoundError } from "../../../../../../../lib/errors";
import { prisma } from "../../../../../../../lib/prisma";
import { processWebhookDelivery } from "../../../../../../../lib/webhooks";

export const POST = createHandler({
  auth: "admin",
  handler: async (ctx) => {
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: ctx.params.id },
      select: { id: true, status: true },
    });
    if (!delivery) {
      throw new NotFoundError(
        "WEBHOOK_DELIVERY_NOT_FOUND",
        "Webhook delivery not found.",
      );
    }

    const result = await processWebhookDelivery(delivery.id);

    return NextResponse.json({
      delivery_id: result.deliveryId,
      attempt_number: result.attemptNumber,
      delivered: result.delivered,
      response_status: result.responseStatus,
    });
  },
});
