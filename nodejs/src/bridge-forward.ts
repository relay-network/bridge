import { z } from "zod";
import { Conversation, DecodedMessage } from "@xmtp/xmtp-js";
import * as Interfaces from "./app.boot.js";

type Message = Pick<DecodedMessage, "senderAddress" | "content"> & {
  conversation: Pick<Conversation, "peerAddress" | "context">;
};

type Reply = ({
  to,
  msg,
}: {
  to: Message["conversation"];
  msg: string;
}) => Promise<void>;

export const zMessage = z.object({
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

export const zTargetResponse = z.object({
  message: z.string(),
});

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

export const createHandler = ({
  bridgeAddress,
  targetUrl,
  reply,
}: {
  bridgeAddress: string;
  targetUrl: string;
  reply?: Reply;
}) => {
  return async (message: Message) => {
    const request = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      url: targetUrl,
      body: {
        bridgeAddress,
        // We parse it because JSON stringify fails on the native XMTP messages.
        message: zMessage.parse(message),
      },
    };

    const fetch = Interfaces.fetch({
      name: `bridge-forward-${bridgeAddress}`,
      zResponse: zTargetResponse,
    });

    const response = await fetch(targetUrl, request);

    if (reply !== undefined) {
      reply({ to: message.conversation, msg: response.message });
    }
  };
};
