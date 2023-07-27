import { z } from "zod";
import { iFetch, iConfig, iXmtpServer, iXmtpClient } from "./interfaces.js";
import * as Util from "./util.js";

/* ************************************************************************
 *
 * FORWARD HANDLER
 *
 * ************************************************************************/

iXmtpServer({
  effect: "forward XMTP to HTTP",
  predicate: Util.getAccessControlPredicate({
    usingWhitelist: [],
    usingBlacklist: [iConfig.xmtpConfig.webhookAddress],
  }),
  handler: (() => {
    const forwardFetch = iFetch({
      effect: "forward XMTP to HTTP",
      zResponse: z.object({
        message: z.string(),
      }),
    });
    return async ({ message }) => {
      const response = await forwardFetch(iConfig.httpConfig.httpUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bridgeAddress: iConfig.xmtpConfig.bridgeAddress,
          message: Util.zMessage.parse(message),
        }),
      });
      //send response
    };
  })(),
});

/* ************************************************************************
 *
 * REVERSE HANDLER
 *
 * ************************************************************************/

iXmtpServer({
  effect: "reverse HTTP to XMTP",
  predicate: Util.getAccessControlPredicate({
    usingWhitelist: [iConfig.xmtpConfig.webhookAddress],
    usingBlacklist: [],
  }),
  handler: (() => {
    const send = iXmtpClient({
      effect: "reverse HTTP to XMTP",
    });
    return async ({ message }) => {
      const data = Util.zJsonString
        .pipe(Util.zSourceRequest)
        .parse(message.content);
      await send({
        toAddress: data.targetAddress,
        message: data.message,
      });
    };
  })(),
});
