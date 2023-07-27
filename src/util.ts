import { DecodedMessage, Conversation } from "@xmtp/xmtp-js";
import { z } from "zod";

export const zJsonString = z.string().transform((val, ctx) => {
  try {
    return JSON.parse(val);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid JSON string",
    });

    return z.NEVER;
  }
});

export const getRandom = <T>(arr: T[]): T => {
  return arr[Math.floor(Math.random() * arr.length)];
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const getAccessControlPredicate = ({
  usingWhitelist,
  usingBlacklist,
}: {
  usingWhitelist?: string[];
  usingBlacklist: string[];
}) => {
  return ({ message }: { message: DecodedMessage }) => {
    if (
      usingBlacklist !== undefined &&
      usingBlacklist.includes(message.senderAddress)
    ) {
      return false;
    }

    if (
      usingWhitelist !== undefined &&
      !usingWhitelist.includes(message.senderAddress)
    ) {
      return false;
    }

    return true;
  };
};

type Message = Pick<DecodedMessage, "senderAddress" | "content"> & {
  conversation: Pick<Conversation, "peerAddress" | "context">;
};

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

export const zSourceRequest = z.object({
  targetAddress: z.string(),
  message: z.string(),
});
