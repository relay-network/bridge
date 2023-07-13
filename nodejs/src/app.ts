import { z } from "zod";
import * as Interfaces from "./app.boot.js";
import * as BridgeForward from "./bridge-forward.js";
import * as BridgeReverse from "./bridge-reverse.js";

const BRIDGE_HEARTBEAT_TIMEOUT_MS = 1000 * 60 * 2;

const env = Interfaces.env({
  name: "env-for-bridge",
  zEnv: z.object({
    XMTPB_BRIDGE_ADDRESS: z.string(),
  }),
});

(async () => {
  const bridgeConfig = await Interfaces.prisma.bridge.findUnique({
    where: {
      ethAddress: env.XMTPB_BRIDGE_ADDRESS,
    },
    include: {
      forwardHandler: true,
    },
  });

  if (bridgeConfig === null) {
    /* eslint-disable-next-line no-console */
    console.log(
      "Bridge for address " +
        env.XMTPB_BRIDGE_ADDRESS +
        "was not found in the database."
    );
    throw new Error("Bridge not found " + env.XMTPB_BRIDGE_ADDRESS);
  } else {
    (async () => {
      setInterval(async () => {
        Interfaces.prisma.instance.update({
          where: {
            bridgeId: bridgeConfig.id,
          },
          data: {
            heartbeat: new Date(),
          },
        });
      }, BRIDGE_HEARTBEAT_TIMEOUT_MS / 2);
    })();

    /* ************************************************************************
     *
     * CANARY
     *
     * ************************************************************************/

    Interfaces.xmtpStream(
      "canary",
      Interfaces.xmtpHandler({
        name: "canary-forward",
        predicate: BridgeForward.createPredicate({
          whitelist: [bridgeConfig.canaryAddress],
          blacklist: [],
        }),
        zI: BridgeForward.zMessage,
        impl: BridgeForward.createHandler({
          bridgeAddress: bridgeConfig.ethAddress,
          targetUrl: "https://api.bridge.relay.network/canary",
          reply: async ({ msg }) => {
            Interfaces.xmtpSend({
              toAddress: bridgeConfig.canaryAddress,
              msg,
            });
          },
        }),
      })
    );

    /* ************************************************************************
     *
     * FORWARD HANDLER
     *
     * ************************************************************************/

    Interfaces.xmtpStream(
      "forward-handler",
      Interfaces.xmtpHandler({
        name: "bridge-forward",
        predicate: BridgeForward.createPredicate({
          blacklist: [
            bridgeConfig.canaryAddress,
            bridgeConfig.webhookAddress,
            env.XMTPB_BRIDGE_ADDRESS,
          ],
        }),
        zI: BridgeForward.zMessage,
        impl: BridgeForward.createHandler({
          bridgeAddress: bridgeConfig.ethAddress,
          targetUrl: bridgeConfig.forwardHandler.httpUrl,
          reply: async ({ to, msg }) => {
            Interfaces.xmtpSend({
              toAddress: to.peerAddress,
              toConversationId: to.context?.conversationId,
              msg,
            });
          },
        }),
      })
    );

    /* ************************************************************************
     *
     * REVERSE HANDLER
     *
     * ************************************************************************/

    Interfaces.xmtpStream(
      "reverse-handler",
      Interfaces.xmtpHandler({
        name: "webhook-reverse",
        predicate: BridgeReverse.createPredicate({
          whitelist: [bridgeConfig.webhookAddress],
        }),
        zI: BridgeReverse.zI,
        impl: BridgeReverse.createHandler({
          send: Interfaces.xmtpSend,
        }),
      })
    );
  }
})();
