import { z } from "zod";
import { DecodedMessage, Conversation } from "@xmtp/xmtp-js";

export const zPgConnectionString = z.string().transform((val, ctx) => {
  const endProtocolIndex = val.indexOf("://") + 3;
  const protocol = val.substring(0, endProtocolIndex);
  const endUsernameIndex = val.indexOf(":", endProtocolIndex);
  const username = val.substring(endProtocolIndex, endUsernameIndex);
  const endPasswordIndex = val.indexOf("@", endUsernameIndex);
  const password = val.substring(endUsernameIndex + 1, endPasswordIndex);
  const endHostIndex = val.indexOf(":", endPasswordIndex);
  const host = val.substring(endPasswordIndex + 1, endHostIndex);
  const endPortIndex = val.indexOf("/", endHostIndex);
  const port = val.substring(endHostIndex + 1, endPortIndex);
  const database = val.substring(endPortIndex + 1);

  if (protocol !== "postgresql://") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid protocol",
    });
  }

  if (username.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid username",
    });
  }

  if (password.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid password",
    });
  }

  if (host.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid host",
    });
  }

  if (port.length !== 4) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid port",
    });
  }

  if (database.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid database",
    });
  }

  return val;
});

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
  usingBlacklist?: string[];
}) => {
  return (message: DecodedMessage) => {
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
