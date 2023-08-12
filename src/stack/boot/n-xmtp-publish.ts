import * as Effect from "./2-effect.js";
import { client } from "./n-xmtp-client.js";

export const create = ({ feature }: { feature: string }) => {
  return (request: string) => {
    const effect = Effect.create({
      api: "xmtp-publish",
      feature,
      request: "register",
    });

    effect.attempt();

    const send = async ({
      toAddress,
      toConversationId,
      message,
    }: {
      toAddress: string;
      toConversationId?: string;
      message: string;
    }) => {
      const effect = Effect.create({
        api: "xmtp-publish",
        feature,
        request,
        metadata: { toAddress, toConversationId },
      });

      effect.attempt();

      const conversation = await (async () => {
        try {
          return await client.conversations.newConversation(
            toAddress,
            (() => {
              if (toConversationId === undefined) {
                return undefined;
              } else {
                return {
                  conversationId: toConversationId,
                  metadata: {},
                };
              }
            })()
          );
        } catch (error) {
          effect.failure(
            error,
            "client.conversations.newConversation() threw an error"
          );
          throw error;
        }
      })();

      const sent = await (async () => {
        try {
          return await conversation.send(message);
        } catch (error) {
          effect.failure(error, "conversation.send() threw an error");
          throw error;
        }
      })();

      effect.success();

      return sent;
    };

    effect.success();

    return send;
  };
};
