import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { createHandler } from "../../../../../../lib/handler";
import { NotFoundError } from "../../../../../../lib/errors";
import { prisma } from "../../../../../../lib/prisma";
import { processWebhookDelivery } from "../../../../../../lib/webhooks";
import { serializeWebhookDelivery } from "../../../../../../lib/serializers";

export const POST = createHandler({
  auth: "merchant",
  handler: async (ctx) => {
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: ctx.params.id, merchantId: ctx.merchantId },
    });
    if (!endpoint) {
      throw new NotFoundError(
        "WEBHOOK_ENDPOINT_NOT_FOUND",
        "Webhook endpoint not found.",
      );
    }

    const testPayload = {
      type: "endpoint.test",
      data: {
        endpoint_id: endpoint.id,
        url: endpoint.url,
        timestamp: new Date().toISOString(),
      },
    };

    const delivery = await prisma.webhookDelivery.create({
      data: {
        merchantId: ctx.merchantId,
        webhookEndpointId: endpoint.id,
        eventType: "endpoint.test",
        payload: testPayload as unknown as Prisma.InputJsonValue,
        status: "PENDING",
      },
    });

    const result = await processWebhookDelivery(delivery.id);

    const updated = await prisma.webhookDelivery.findUnique({
      where: { id: delivery.id },
      include: {
        attempts: {
          select: {
            attemptNumber: true,
            responseStatus: true,
            createdAt: true,
            completedAt: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        webhook_delivery: updated ? serializeWebhookDelivery(updated) : null,
        delivered: result.delivered,
        response_status: result.responseStatus,
      },
      { status: 201 },
    );
  },
});
