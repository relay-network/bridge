import { z } from "zod";
import express from "express";
import { sConfig } from "./stack/config.js";
import { sLogger } from "./stack/effect.js";
import { sExpressRoute } from "./stack/express-route.js";

const logListening = sLogger.create({
  api: "logger",
  feature: "canary",
  request: "listen",
}).success;

const expressConfig = sConfig.express();

const route = sExpressRoute.create({
  feature: "canary.ts",
});

const CANARY_MESSAGE_LOG: Array<{ content: string }> = [];

const app = express();

app.use(express.json());

route("post a message from bridge")({
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
  zParams: z.unknown(),
  zQuery: z.unknown(),
  zResponse: z.object({
    message: z.string(),
  }),
  handler: async ({ b }) => {
    CANARY_MESSAGE_LOG.push(b.message);

    return {
      status: 200,
      data: {
        message: `Hello from the canary, the bridge ${b.bridgeAddress} sent the message ${b.message.content}`,
      },
    };
  },
});

route("canary logs")({
  server: app,
  url: "/logs",
  method: "get",
  zBody: z.unknown(),
  zQuery: z.unknown(),
  zParams: z.unknown(),
  zResponse: z.array(z.object({ content: z.string() })),
  handler: async () => {
    return { status: 200, data: CANARY_MESSAGE_LOG };
  },
});

app.listen(expressConfig.port, () => {
  logListening(`Listening on port ${expressConfig.port}`);
});
