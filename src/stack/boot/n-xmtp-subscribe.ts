import { DecodedMessage } from "@xmtp/xmtp-js";
import * as Effect from "./2-effect.js";
import { client } from "./n-xmtp-client.js";

const stream = await (async () => {
  const effect = Effect.create({
    api: "xmtp-subscribe",
    feature: "init message stream",
    request: "create the message stream",
  });

  effect.attempt();

  const created = await (async () => {
    try {
      return await client.conversations.streamAllMessages();
    } catch (err) {
      effect.failure(
        err,
        "client.conversations.streamAllMessages() threw an error"
      );
      throw err;
    }
  })();

  effect.success();

  return created;
})();

const listeners: Array<(message: DecodedMessage) => unknown> = [];

(async () => {
  for await (const message of stream) {
    for (const listener of listeners) {
      listener(message);
    }
  }
})();

export const create =
  ({ feature }: { feature: string }) =>
  (request: string) =>
  ({
    router,
    handler,
  }: {
    router: (message: DecodedMessage) => boolean;
    handler: (message: DecodedMessage) => unknown;
  }) => {
    const effect = Effect.create({
      api: "xmtp-subscribe",
      feature,
      request: "register",
    });

    effect.attempt();

    listeners.push(async (message) => {
      const isRouteMatch = (() => {
        const effect = Effect.create({
          api: "xmtp-subscribe",
          feature,
          request,
          metadata: {
            senderAddress: message.senderAddress,
            id: message.id,
          },
        });

        effect.attempt();

        const isMatch = (() => {
          try {
            return router(message);
          } catch (err) {
            effect.failure(err, "router(message) threw an error");
            return false;
          }
        })();

        effect.success();

        return isMatch;
      })();

      if (!isRouteMatch) {
        return;
      } else {
        const effect = Effect.create({
          api: "xmtp-subscribe",
          feature,
          request: `${message.senderAddress}/${message.id}`,
        });

        effect.attempt();

        try {
          await handler(message);
        } catch (err) {
          effect.failure(err, "handler(message) threw an error");
          throw err;
        }

        effect.success();
      }
    });

    effect.success();
  };
