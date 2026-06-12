import type { TransportAdapter, EventEnvelope, PublishResult, Logger } from "../types.js";

const consoleLogger: Logger = {
  info: (message, context) => console.log(JSON.stringify({ level: "info", message, ...context })),
  error: (message, context) => console.error(JSON.stringify({ level: "error", message, ...context })),
};

export function withLogging(adapter: TransportAdapter, logger: Logger = consoleLogger): TransportAdapter {
  return {
    async publish(envelope: EventEnvelope): Promise<PublishResult> {
      const start = Date.now();
      logger.info("publishing event", { eventId: envelope.eventId, version: envelope.version, traceId: envelope.metadata.traceId });
      try {
        const result = await adapter.publish(envelope);
        logger.info("event published", { eventId: envelope.eventId, messageId: result.messageId, durationMs: Date.now() - start });
        return result;
      } catch (err) {
        logger.error("event publish failed", { eventId: envelope.eventId, error: String(err), durationMs: Date.now() - start });
        throw err;
      }
    },
  };
}
