import { z } from "zod";
import * as Interfaces from "./webhook.boot.js";
import express from "express";

const app = express();

app.use(express.json());

Interfaces.express.bind({
  toServer: app,
  toRoute: {
    url: "/send",
    method: "post",
    zBody: z.object({
      targetAddress: z.string(),
      bridgeAddress: z.string(),
      message: z.string(),
    }),
    zResponse: z.object({
      id: z.string(),
      message: z.string(),
    }),
  },
  usingHandler: async ({ bridgeAddress, targetAddress, message }) => {
    const sent = await Interfaces.xmtpSend({
      toAddress: bridgeAddress,
      msg: JSON.stringify({
        targetAddress,
        message,
      }),
    });
    return {
      id: sent.id,
      toAddress: sent.conversation.peerAddress,
      message: sent.content,
    };
  },
});

const env = Interfaces.env({
  name: "webhook",
  zEnv: z.object({
    XMTPB_WEBHOOK_PORT: z.string(),
  }),
});

app.listen(env.XMTPB_WEBHOOK_PORT, () => {
  /* eslint-disable-next-line no-console */
  console.log("Listening on port " + env.XMTPB_WEBHOOK_PORT);
});
