import { z } from "zod";
import * as Forward from "./bridge-forward.js";
import * as Reverse from "./bridge-reverse.js";
import * as Interfaces from "./boot.js";

const BRIDGE_HEARTBEAT_TIMEOUT_MS = 1000 * 60 * 2;

const env = Interfaces.env({
  name: "env-for-bridge",
  zEnv: z.object({
    XMTPB_BRIDGE_ADDRESS: z.string(),
    XMTPB_WEBHOOK_KEY: z.string(),
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

    /* TODO HERE */

    /*
     * Canary proxy
     */

    // addHandler(
    //   server,
    //   Forward.handler({
    //     whitelist: [bridgeConfig.canaryAddress],
    //     blacklist: [],
    //     // TODO - This is clearly a hack, what to do about it?
    //     targetUrl: "https://api.bridge.relay.network/canary",
    //     isBot: true,
    //   })
    // );

    /*
     * Primary (XMTP -> HTTP) proxy
     */

    // addHandler(
    //   server,
    //   Forward.handler({
    //     blacklist: [
    //       bridgeConfig.canaryAddress,
    //       server.address,
    //       WEBHOOK_ADDRESS,
    //     ],
    //     targetUrl: bridgeConfig.forwardHandler.httpUrl,
    //     isBot: bridgeConfig.forwardHandler.isBot,
    //   })
    // );

    /*
     * Webhook (HTTP -> XMTP) proxy
     */

    // addHandler(server, Reverse.handler({ whitelist: [WEBHOOK_ADDRESS] }));
  }
})();
