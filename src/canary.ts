import { z } from "zod";
import { iLogger, iExpress } from "./interfaces.js";
import express from "express";

const CANARY_MESSAGE_LOG: Array<{ content: string }> = [];

const app = express();

app.use(express.json());

iExpress({
  effect: "canary",
  server: app,
  url: "/canary",
  method: "post",
  zBody: z.object({
    bridgeAddress: z.string(),
    message: z.object({
      senderAddress: z.string(),
      content: z.string(),
      conversation: z.object({
        peerAddress: z.string(),
        context: z
          .object({
            conversationId: z.string(),
            metadata: z.record(z.string()),
          })
          .optional(),
      }),
    }),
  }),
  zQuery: z.unknown(),
  zResponse: z.object({
    message: z.string(),
  }),
  handler: async ({ b }) => {
    CANARY_MESSAGE_LOG.push(b.message);

    return {
      message: `Hello from the canary, the bridge ${b.bridgeAddress} sent the message ${b.message.content}`,
    };
  },
});

iExpress({
  effect: "canary logs",
  server: app,
  url: "/logs",
  method: "get",
  zBody: z.unknown(),
  zQuery: z.unknown(),
  zResponse: z.array(z.object({ content: z.string() })),
  handler: async () => {
    return CANARY_MESSAGE_LOG;
  },
});

app.listen("8080", () => {
  iLogger.info("Canary listening on port 8080");
});
