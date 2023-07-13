import { z } from "zod";
import * as Interfaces from "./canary.boot.js";
import express from "express";

const CANARY_MESSAGE_LOG: Array<{ content: string }> = [];

const app = express();

app.use(express.json());

Interfaces.express.bind({
  toServer: app,
  toRoute: {
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
    zResponse: z.object({
      message: z.string(),
    }),
  },
  usingHandler: async ({ bridgeAddress, message }) => {
    CANARY_MESSAGE_LOG.push(message);

    return {
      message: `Hello from the canary, the bridge ${bridgeAddress} sent the message ${message.content}`,
    };
  },
});

Interfaces.express.bind({
  toServer: app,
  toRoute: {
    url: "/log",
    method: "get",
    zBody: z.unknown(),
    zResponse: z.array(z.object({ content: z.string() })),
  },
  usingHandler: async () => {
    return CANARY_MESSAGE_LOG;
  },
});

const env = Interfaces.env({
  name: "canary",
  zEnv: z.object({
    XMTPB_CANARY_PORT: z.string(),
  }),
});

app.listen(env.XMTPB_CANARY_PORT, () => {
  /* eslint-disable-next-line no-console */
  console.log("Listening on port " + env.XMTPB_CANARY_PORT);
});
