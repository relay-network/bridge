import { Client, DecodedMessage } from "@xmtp/xmtp-js";

type MessageHandler = ({
  message,
}: {
  message: DecodedMessage;
}) => Promise<void>;

export const createInterface = ({
  createClient,
  onStreamCreated,
  onStreamCreateError,
  onMessage,
  onAddListener,
  onListenerError,
  onError,
}: {
  createClient: () => Promise<Client>;
  onStreamCreated: () => void;
  onStreamCreateError: ({ error }: { error: unknown }) => void;
  onAddListener: ({ name }: { name: string }) => void;
  onMessage: ({
    message,
    listeners,
  }: {
    message: DecodedMessage;
    listeners: string[];
  }) => void;
  onListenerError: ({
    name,
    message,
    error,
  }: {
    name: string;
    message: DecodedMessage;
    error: unknown;
  }) => void;
  onError: ({ error }: { error: unknown }) => void;
}) => {
  const listeners: Array<{
    name: string;
    handler: ({ message }: { message: DecodedMessage }) => Promise<void>;
  }> = [];

  (async () => {
    const client = await createClient();

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
          const namesOfListeners = listeners.map(({ name }) => name);
          onMessage({ message, listeners: namesOfListeners });
        } catch (error) {
          onError({ error });
          throw new Error(
            "xmtp-stream.ts :: createInterface :: onError did not throw"
          );
        }

        for (const { name, handler } of listeners) {
          handler({ message }).catch((error) => {
            onListenerError({ name, message, error });
          });
        }
      }
    })();
  })();

  return (name: string, handler: MessageHandler) => {
    try {
      onAddListener({ name });
    } catch (error) {
      onError({ error });
      throw new Error(
        "xmtp-stream.ts :: createInterface :: onError did not throw"
      );
    }
    listeners.push({ name, handler });
  };
};
