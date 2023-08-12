import { z } from "zod";
import { sConfig } from "./stack/config.js";
import { sLogger } from "./stack/effect.js";
import { sExpressRoute } from "./stack/express-route.js";
import { sXmtpPublish } from "./stack/xmtp-publish.js";

import express from "express";

const logListening = sLogger.create({
  api: "logger",
  feature: "webhook",
  request: "listen",
}).success;

const route = sExpressRoute.create({
  feature: "webhook.ts",
});

const publish = sXmtpPublish.create({
  feature: "webhook.ts",
});

const app = express();

app.use(express.json());

route("post a message that will be sent to the bridge")({
  server: app,
  url: "/send",
  method: "post",
  zBody: z.object({
    targetAddress: z.string(),
    bridgeAddress: z.string(),
    message: z.string(),
  }),
  zQuery: z.unknown(),
  zParams: z.unknown(),
  zResponse: z.object({
    id: z.string(),
    message: z.string(),
  }),
  handler: (() => {
    return async ({ b }) => {
      const sent = await publish("Forward the inbound message to XMTP")({
        toAddress: b.bridgeAddress,
        message: JSON.stringify({
          targetAddress: b.targetAddress,
          message: b.message,
        }),
      });
      return {
        status: 200,
        data: {
          id: sent.id,
          message: sent.content,
        },
      };
    };
  })(),
});

app.listen(sConfig.express().port, () => {
  logListening(`Listening on port ${sConfig.express().port}`);
});
