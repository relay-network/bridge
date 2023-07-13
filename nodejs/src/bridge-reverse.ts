import { z } from "zod";
import { Conversation, DecodedMessage } from "@xmtp/xmtp-js";
import * as Interfaces from "./app.boot.js";
import { zJsonString } from "./util.js";
import { Send } from "./xmtp-send.js";

type Message = Pick<DecodedMessage, "senderAddress" | "content"> & {
  conversation: Pick<Conversation, "peerAddress" | "context">;
};

const zMessage = z.object({
  senderAddress: z.string(),
  content: z.string(),
  conversation: z.object({
    peerAddress: z.string(),
    context: z
      .object({
        conversationId: z.string(),
        metadata: z.record(z.string()),
      })
      .optional(),
  }),
}) satisfies z.Schema<Message>;

const zSourceRequest = z.object({
  targetAddress: z.string(),
  message: z.string(),
});

export const zI = zMessage
  .transform((val) => {
    return val.content;
  })
  .pipe(zJsonString)
  .pipe(zSourceRequest);

export const createPredicate = ({
  whitelist,
  blacklist,
}: {
  whitelist?: string[];
  blacklist?: string[];
}) => {
  return ({ message }: { message: DecodedMessage }) => {
    if (blacklist !== undefined && blacklist.includes(message.senderAddress)) {
      return false;
    }

    if (whitelist !== undefined && !whitelist.includes(message.senderAddress)) {
      return false;
    }

    return true;
  };
};

export const createHandler = ({ send }: { send: Send }) => {
  return async (fromHook: z.infer<typeof zSourceRequest>) => {
    await send({
      toAddress: fromHook.targetAddress,
      msg: fromHook.message,
    });
  };
};
