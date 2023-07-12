import { Client, DecodedMessage } from "@xmtp/xmtp-js";

export const createInterface = async ({
  createClient,
  onStreamCreated,
  onStreamCreateError,
  onMessage,
  onListenerError,
  onError,
}: {
  createClient: () => Promise<Client>;
  onStreamCreated: () => void;
  onStreamCreateError: ({ error }: { error: unknown }) => void;
  onMessage: ({ message }: { message: DecodedMessage }) => void;
  onListenerError: ({
    message,
    error,
  }: {
    message: DecodedMessage;
    error: unknown;
  }) => void;
  onError: ({ error }: { error: unknown }) => void;
}) => {
  const client = await createClient();

  const listeners: Array<
    ({ message }: { message: DecodedMessage }) => Promise<void>
  > = [];

  (async () => {
    const stream = await (async () => {
      try {
        return await client.conversations.streamAllMessages();
      } catch (error) {
        onStreamCreateError({ error });
        throw new Error(
          "xmtp-stream.ts :: createInterface :: onStreamCreateError did not throw"
        );
      }
    })();

    try {
      onStreamCreated();
    } catch (error) {
      onError({ error });
      throw new Error(
        "xmtp-stream.ts :: createInterface :: onError did not throw"
      );
    }

    (async () => {
      for await (const message of stream) {
        try {
          onMessage({ message });
        } catch (error) {
          onError({ error });
          throw new Error(
            "xmtp-stream.ts :: createInterface :: onError did not throw"
          );
        }

        for (const listener of listeners) {
          listener({ message }).catch((error) => {
            onListenerError({ message, error });
            throw new Error(
              "xmtp-stream.ts :: createInterface :: onListenerError did not throw"
            );
          });
        }
      }
    })();
  })();

  return ({ handler }: { handler: () => Promise<void> }) => {
    listeners.push(handler);
  };
};
