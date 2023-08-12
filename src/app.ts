import { z } from "zod";
import { sConfig } from "./stack/config.js";
import { sXmtpSubscribe } from "./stack/xmtp-subscribe.js";
import { sXmtpPublish } from "./stack/xmtp-publish.js";
import { sFetch } from "./stack/fetch.js";
import { sInvariant } from "./stack/invariant.js";

import * as Util from "./util.js";

const bridgeConfig = sConfig.bridge();
const xmtpConfig = sConfig.xmtp();

const subscribe = sXmtpSubscribe.create({
  feature: "app.ts",
});

const publish = sXmtpPublish.create({
  feature: "app.ts",
});

const fetch = sFetch.create({
  feature: "app.ts",
});

const invariant = sInvariant.create({
  feature: "app.ts",
});

/* ************************************************************************
 *
 * FORWARD HANDLER
 *
 * ************************************************************************/

subscribe("forward XMTP to HTTP")({
  router: Util.getAccessControlPredicate({
    usingBlacklist: [xmtpConfig.address, bridgeConfig.webhookAddress],
  }),
  handler: (() => {
    return async (message) => {
      const body = await invariant("message -> parse -> stringify works")(
        async () => {
          return JSON.stringify({
            bridgeAddress: xmtpConfig.address,
            message: Util.zMessage.parse(message),
          });
        }
      )();

      const response = await fetch("call the target HTTP endpoint")(
        bridgeConfig.httpUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body,
        }
      );

      const json = await invariant("response -> parse -> json works")(
        async () => response.json()
      )();

      const responseMessage = await invariant(
        "response -> parse -> response.message works"
      )(async () => {
        return z.object({ message: z.string() }).parse(json).message;
      })();

      publish("send the HTTP response back to XMTP")({
        toAddress: message.senderAddress,
        message: responseMessage,
      });
    };
  })(),
});

/* ************************************************************************
 *
 * REVERSE HANDLER
 *
 * ************************************************************************/

subscribe("reverse HTTP to XMTP")({
  router: Util.getAccessControlPredicate({
    usingWhitelist: [bridgeConfig.webhookAddress],
  }),
  handler: (() => {
    return async (message) => {
      const data = await invariant(
        "message -> json parse -> schema parse -> zSourceRequest"
      )(async () => {
        return Util.zJsonString
          .pipe(Util.zSourceRequest)
          .parse(message.content);
      })();

      await publish("send the webhook's message to its target")({
        toAddress: data.targetAddress,
        message: data.message,
      });
    };
  })(),
});
