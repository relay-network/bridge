import { z } from "zod";
import { DecodedMessage } from "@xmtp/xmtp-js";

type Route<I extends z.ZodTypeAny, O extends z.ZodTypeAny> = {
  predicate: (msg: DecodedMessage) => boolean;
  zI: I;
  zO: O;
  handler: (i: I) => Promise<O>;
};

export const createInterface = ({
  onAcceptMessage,
  onAcceptedMessageError,
  onHandlerError,
  onHandlerResponse,
  onHandlerResponseError,
  onSuccess,
  onError,
}: {
  onAcceptMessage: ({ msg }: { msg: DecodedMessage }) => void;
  onAcceptedMessageError: ({
    msg,
    error,
  }: {
    msg: DecodedMessage;
    error: unknown;
  }) => void;
  onHandlerError: ({
    msg,
    error,
  }: {
    msg: DecodedMessage;
    error: unknown;
  }) => void;
  onHandlerResponse: ({
    msg,
    response,
  }: {
    msg: DecodedMessage;
    response: unknown;
  }) => void;
  onHandlerResponseError: ({
    msg,
    error,
  }: {
    msg: DecodedMessage;
    error: unknown;
  }) => void;
  onSuccess: ({ msg }: { msg: DecodedMessage }) => void;
  onError: ({ error }: { error: unknown }) => void;
}) => {
  return <I extends z.ZodTypeAny, O extends z.ZodTypeAny>({
    predicate,
    zI,
    zO,
    handler,
  }: Route<I, O>) => {
    return async ({ msg }: { msg: DecodedMessage }) => {
      if (!predicate(msg)) {
        return;
      } else {
        try {
          onAcceptMessage({ msg });
        } catch (error) {
          onError({ error });
          throw new Error(
            "xmtp-stream.ts :: createInterface :: onAcceptMessage did not throw"
          );
        }
      }

      const validatedMessage = (() => {
        try {
          return zI.parse(msg);
        } catch (error) {
          onAcceptedMessageError({ msg, error });
          throw new Error(
            "xmtp-stream.ts :: createInterface :: onAcceptMessageError did not throw"
          );
        }
      })();

      const response = await (async () => {
        try {
          return await handler(validatedMessage);
        } catch (error) {
          onHandlerError({ msg, error });
          throw new Error(
            "xmtp-stream.ts :: createInterface :: onHandlerError did not throw"
          );
        }
      })();

      try {
        onHandlerResponse({ msg, response });
      } catch (error) {
        onError({ error });
        throw new Error(
          "xmtp-stream.ts :: createInterface :: onError did not throw"
        );
      }

      const validatedResponse = (() => {
        try {
          return zO.parse(response);
        } catch (error) {
          onHandlerResponseError({ msg, error });
          throw new Error(
            "xmtp-stream.ts :: createInterface :: onHandlerResponseError did not throw"
          );
        }
      })();

      try {
        onSuccess({ msg });
      } catch (error) {
        onError({ error });
        throw new Error(
          "xmtp-stream.ts :: createInterface :: onError did not throw"
        );
      }

      return validatedResponse;
    };
  };
};
