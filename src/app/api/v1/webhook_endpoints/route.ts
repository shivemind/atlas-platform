import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "../../../../lib/handler";
import { prisma } from "../../../../lib/prisma";
import { serializeWebhookEndpoint } from "../../../../lib/serializers";
import { generateWebhookSecret } from "../../../../lib/webhooks";

const createWebhookEndpointSchema = z.object({
  url: z.url(),
  enabled_events: z.array(z.string().min(1)).min(1),
});

export const POST = createHandler({
  auth: "merchant",
  validate: createWebhookEndpointSchema,
  handler: async (ctx) => {
    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        merchantId: ctx.merchantId,
        url: ctx.body.url,
        secret: generateWebhookSecret(),
        eventTypes: ctx.body.enabled_events,
        isActive: true,
      },
    });
    return NextResponse.json(
      {
        webhook_endpoint: serializeWebhookEndpoint(endpoint, {
          includeSecret: true,
        }),
      },
      { status: 201 },
    );
  },
});

export const GET = createHandler({
  auth: "merchant",
  handler: async (ctx) => {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { merchantId: ctx.merchantId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      data: endpoints.map((e) =>
        serializeWebhookEndpoint(e, { includeSecret: true }),
      ),
    });
  },
});
