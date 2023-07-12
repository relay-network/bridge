import { Client, Conversation, DecodedMessage } from "@xmtp/xmtp-js";

type Send = ({
  toAddress,
  toConversationId,
  msg,
}: {
  toAddress: string;
  toConversationId?: string;
  msg: string;
}) => Promise<DecodedMessage>;

export const createInterface = ({
  createClient,
  onCreateConversation,
  onCreateConversationError,
  onSend,
  onSendError,
  onSuccess,
  onError,
}: {
  createClient: () => Promise<Client>;
  onCreateConversation: ({
    conversation,
  }: {
    conversation: Conversation;
  }) => void;
  onCreateConversationError: ({
    address,
    conversationId,
    error,
  }: {
    address: string;
    conversationId?: string;
    error: unknown;
  }) => void;
  onSend: ({
    toAddress,
    toConversationId,
    msg,
  }: {
    toAddress: string;
    toConversationId?: string;
    msg: string;
  }) => void;
  onSendError: ({
    toAddress,
    toConversationId,
    msg,
    error,
  }: {
    toAddress: string;
    toConversationId?: string;
    msg: string;
    error: unknown;
  }) => void;
  onSuccess: ({
    toAddress,
    toConversationId,
    msg,
  }: {
    toAddress: string;
    toConversationId?: string;
    msg: string;
  }) => void;
  onError: ({
    toAddress,
    toConversationId,
    msg,
    error,
  }: {
    toAddress: string;
    toConversationId?: string;
    msg: string;
    error: unknown;
  }) => void;
}): Send => {
  return async ({ toAddress, toConversationId, msg }) => {
    // We assume this interface has been booted somewhere else, so we don't need
    // to instrument it at all.
    const toClient = await createClient();

    try {
      onSend({ toAddress, toConversationId, msg });
    } catch (error) {
      onError({ toAddress, toConversationId, msg, error });
      throw new Error("xmtp.ts :: createInterface :: onError did not throw");
    }

    const conversation = await (async () => {
      try {
        return await toClient.conversations.newConversation(
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
        onCreateConversationError({
          address: toAddress,
          conversationId: toConversationId,
          error,
        });
        throw new Error(
          "xmtp.ts :: createInterface :: onCreateConversationError did not throw"
        );
      }
    })();

    try {
      onCreateConversation({ conversation });
    } catch (error) {
      onError({ toAddress, toConversationId, msg, error });
      throw new Error("xmtp.ts :: createInterface :: onError did not throw");
    }

    const sent = await (async () => {
      try {
        return await conversation.send(msg);
      } catch (error) {
        onSendError({ toAddress, toConversationId, msg, error });
        throw new Error(
          "xmtp.ts :: createInterface :: onSendError did not throw"
        );
      }
    })();

    try {
      onSuccess({ toAddress, toConversationId, msg });
    } catch (error) {
      onError({ toAddress, toConversationId, msg, error });
      throw new Error("xmtp.ts :: createInterface :: onError did not throw");
    }

    return sent;
  };
};
