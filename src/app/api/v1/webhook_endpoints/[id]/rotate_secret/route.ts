import { NextResponse } from "next/server";

import { createHandler } from "../../../../../../lib/handler";
import { NotFoundError } from "../../../../../../lib/errors";
import { prisma } from "../../../../../../lib/prisma";
import { serializeWebhookEndpoint } from "../../../../../../lib/serializers";
import { generateWebhookSecret } from "../../../../../../lib/webhooks";

export const POST = createHandler({
  auth: "merchant",
  handler: async (ctx) => {
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id: ctx.params.id, merchantId: ctx.merchantId },
    });
    if (!existing) {
      throw new NotFoundError(
        "WEBHOOK_ENDPOINT_NOT_FOUND",
        "Webhook endpoint not found.",
      );
    }

    const updated = await prisma.webhookEndpoint.update({
      where: { id: existing.id },
      data: { secret: generateWebhookSecret() },
    });

    return NextResponse.json({
      webhook_endpoint: serializeWebhookEndpoint(updated, {
        includeSecret: true,
      }),
    });
  },
});
