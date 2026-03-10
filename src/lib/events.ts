import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "./prisma";
import { queueWebhookEvent } from "./webhooks";

type EventClient = PrismaClient | Prisma.TransactionClient;

export interface DomainEventInput {
  merchantId: string;
  type: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  actorType?: string;
  actorId?: string;
}

/**
 * Central domain event emitter. A single call:
 *   1. Persists the event to the Event table (for Events API queries)
 *   2. Queues webhook deliveries for matching endpoints
 *   3. Writes an audit log entry when actor info is provided
 *
 * Always pass the transaction client when called inside a $transaction
 * so that event persistence is atomic with the business operation.
 */
export async function emitDomainEvent(
  client: EventClient,
  input: DomainEventInput,
): Promise<string> {
  const {
    merchantId,
    type,
    entityType,
    entityId,
    payload,
    actorType,
    actorId,
  } = input;

  const event = await client.event.create({
    data: {
      merchantId,
      type,
      entityType,
      entityId,
      payload: payload as Prisma.InputJsonValue,
      actorType,
      actorId,
    },
  });

  if (actorType && actorId) {
    await client.auditLog.create({
      data: {
        merchantId,
        action: type,
        actorType,
        actorId,
        entityType,
        entityId,
        metadata: payload as Prisma.InputJsonValue,
      },
    });
  }

  await queueWebhookEvent({
    merchantId,
    eventType: type,
    payload: { type, data: payload },
    prismaClient: client,
  });

  return event.id;
}

/**
 * Convenience wrapper when you're not inside a transaction.
 * Opens its own transaction to keep event + webhook atomic.
 */
export async function emitEvent(input: DomainEventInput): Promise<string> {
  return prisma.$transaction((tx) => emitDomainEvent(tx, input));
}
