import { z } from "zod";
import { DecodedMessage } from "@xmtp/xmtp-js";
import { logger } from "./app.boot.js";

type HandlerConfig<I extends z.ZodTypeAny> = {
  name: string;
  predicate: ({ message }: { message: DecodedMessage }) => boolean;
  zI: I;
  impl: (i: z.infer<I>) => unknown;
};

export const createInterface = ({
  onAcceptMessage,
  onAcceptedMessageValidationError,
  onHandlerError,
  onHandlerResponse,
  onSuccess,
  onError,
}: {
  onAcceptMessage: ({
    name,
    msg,
  }: {
    name: string;
    msg: DecodedMessage;
  }) => void;
  onAcceptedMessageValidationError: ({
    name,
    msg,
    error,
  }: {
    name: string;
    msg: DecodedMessage;
    error: unknown;
  }) => void;
  onHandlerError: ({
    name,
    msg,
    error,
  }: {
    name: string;
    msg: DecodedMessage;
    error: unknown;
  }) => void;
  onHandlerResponse: ({
    name,
    msg,
    response,
  }: {
    name: string;
    msg: DecodedMessage;
    response: unknown;
  }) => void;
  onSuccess: ({ name, msg }: { name: string; msg: DecodedMessage }) => void;
  onError: ({ name, error }: { name: string; error: unknown }) => void;
}) => {
  return <I extends z.ZodTypeAny>({
    name,
    predicate,
    zI,
    impl,
  }: HandlerConfig<I>) => {
    return async ({ message }: { message: DecodedMessage }) => {
      if (!predicate({ message })) {
        return;
      }

      try {
        onAcceptMessage({ name, msg: message });
      } catch (error) {
        onError({ name, error });
        throw new Error(
          "xmtp-stream.ts :: createInterface :: onAcceptMessage did not throw"
        );
      }

      const validatedMessage: z.infer<typeof zI> = (() => {
        try {
          const v = zI.parse(message, {
            errorMap: () => {
              return { message: "Failed to validate inbound message" };
            },
          });
          return v;
        } catch (error) {
          onAcceptedMessageValidationError({ name, msg: message, error });
          throw new Error(
            "xmtp-stream.ts :: createInterface :: onAcceptMessageError did not throw"
          );
        }
      })();

      const response = await (async () => {
        try {
          return await impl(validatedMessage);
        } catch (error) {
          onHandlerError({ name, msg: message, error });
          throw new Error(
            "xmtp-stream.ts :: createInterface :: onHandlerError did not throw"
          );
        }
      })();

      try {
        onHandlerResponse({ name, msg: message, response });
      } catch (error) {
        onError({ name, error });
        throw new Error(
          "xmtp-stream.ts :: createInterface :: onError did not throw"
        );
      }

      try {
        onSuccess({ name, msg: message });
      } catch (error) {
        onError({ name, error });
        throw new Error(
          "xmtp-stream.ts :: createInterface :: onError did not throw"
        );
      }
    };
  };
};
