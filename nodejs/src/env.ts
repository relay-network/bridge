/* eslint-disable no-console */
import { z } from "zod";

const ENV_REGISTRY = {
  XMTPB_SENTRY_DSN: process.env.XMTPB_SENTRY_DSN,
  XMTPB_GITHUB_SHA: process.env.XMTPB_GITHUB_SHA,
  XMTPB_SIGNUP_KEY: process.env.XMTPB_SIGNUP_KEY,
  XMTPB_WEBHOOK_KEY: process.env.XMTPB_WEBHOOK_KEY,
  XMTPB_BRIDGE_ADDRESS: process.env.XMTPB_BRIDGE_ADDRESS,
  XMTPB_API_PORT: process.env.XMTPB_API_PORT,
  XMTPB_FORWARD_HANDLER_HTTP_URL: process.env.XMTPB_FORWARD_HANDLER_HTTP_URL,
  XMTPB_FORWARD_HANDLER_IS_BOT: process.env.XMTPB_FORWARD_HANDLER_IS_BOT,
  XMTPB_ENVIRONMENT: process.env.XMTPB_ENVIRONMENT,
} as const;

for (const [key, value] of Object.entries(ENV_REGISTRY)) {
  if (value === undefined) {
    console.log(`WARNING :: process.env.${key} is not set`);
  }
}

export const read = <Z extends z.ZodTypeAny>({
  key,
  schema,
}: {
  key: keyof typeof ENV_REGISTRY;
  schema: Z;
}): z.infer<typeof schema> => {
  try {
    return schema.parse(ENV_REGISTRY[key]);
  } catch (e) {
    console.log(
      `ENV ERROR :: Tried to read key ${key} from process.env, but the passed schema failed to parse it`
    );
    console.log("The value was: " + ENV_REGISTRY[key]);
    // throw e;
  }
};
