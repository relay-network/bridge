import { z } from "zod";
import * as Sentry from "@sentry/node";
import { read } from "../env.js";

Sentry.init({
  dsn: read({ key: "XMTPB_SENTRY_DSN", schema: z.string() }),
  release: read({ key: "XMTPB_GITHUB_SHA", schema: z.string() }),
  environment: read({ key: "XMTPB_ENVIRONMENT", schema: z.string() }),
  serverName:
    read({
      key: "XMTPB_BRIDGE_ADDRESS",
      schema: z.string().or(z.undefined()),
    }) || "api",
});

export const sentry = Sentry;
