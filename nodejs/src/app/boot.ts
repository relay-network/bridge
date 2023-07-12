import { z } from "zod";
import * as Console from "./console.js";
import * as Fetch from "./fetch.js";
import * as XmtpSend from "./xmtp-send.js";
import * as XmtpClient from "./xmtp-client.js";
import * as XmtpStream from "./xmtp-stream.js";
import * as XmtpHandler from "./xmtp-handler.js";
import * as Sentry from "./sentry.js";
import * as Prisma from "./prisma.js";
import * as Process from "./process.js";

/* ****************************************************************************
 *
 * BOOT LOGGER
 *
 * ****************************************************************************/

const _logger = Console.createInterface({ level: "debug" });

/* ****************************************************************************
 *
 * BOOT ENV
 *
 * ****************************************************************************/

const _env = Process.createInterface({
  zEnv: z.object({
    XMTPB_SENTRY_DSN: z.string(),
    XMTPB_GIT_HASH: z.string(),
    XMTPB_ENVIRONMENT: z.string(),
    XMTPB_BRIDGE_ADDRESS: z.string(),
    XMTPB_PG_CONNECTION_STRING: z.string(),
  }),
  onCreate: () => {
    _logger.debug("ENVIRONMENT FOR SENTRY LOADED");
  },
  onCreateError: (err) => {
    _logger.error("ENVIRONMENT FOR SENTRY LOAD ERROR", { err });
  },
  onRead: () => {
    _logger.debug("ENVIRONMENT FOR SENTRY READ");
  },
  onReadError: (err) => {
    _logger.error("ENVIRONMENT FOR SENTRY READ ERROR", { err });
  },
  onError: (err) => {
    _logger.error("ENVIRONMENT FOR SENTRY ERROR", { err });
  },
});

const envForSentry = _env({
  name: "env-for-sentry",
  zEnv: z.object({
    XMTPB_SENTRY_DSN: z.string(),
    XMTPB_GIT_HASH: z.string(),
    XMTPB_ENVIRONMENT: z.string(),
  }),
});

/* ****************************************************************************
 *
 * BOOT SENTRY
 *
 * ****************************************************************************/

const _sentry = Sentry.createInterface({
  dsn: envForSentry.XMTPB_SENTRY_DSN,
  environment: envForSentry.XMTPB_ENVIRONMENT,
  release: envForSentry.XMTPB_GIT_HASH,
});

/* ****************************************************************************
 *
 * BOOT PRISMA
 *
 * ****************************************************************************/

const _prisma = Prisma.createInterface({
  onQuery: (opts) => {
    _logger.debug("PRISMA QUERY", opts);
  },
  onQueryError: (opts) => {
    _logger.error("PRISMA ERROR", opts);
    _sentry.captureException(opts.error, {
      tags: {
        "prisma-query": "fail",
        model: opts.model,
        operation: opts.operation,
      },
    });
    throw opts.error;
  },
});

/* ****************************************************************************
 *
 * BOOT FETCH
 *
 * ****************************************************************************/

const _fetch = Fetch.createInterface({
  onFetch: ({ url }) => {
    _logger.debug("FETCH API CALL", { url });
  },
  onFetchError: ({ url, error }) => {
    _logger.error("FETCH API ERROR", { url, error });
    _sentry.captureException(error, {
      tags: {
        "fetch-api-call": "fail",
        url,
      },
    });
    throw error;
  },
  onResponse: ({ url }) => {
    _logger.debug("FETCH API RESPONSE", { url });
  },
  onResponseError: ({ url, error }) => {
    _logger.error("FETCH API RESPONSE ERROR", { url, error });
    _sentry.captureException(error, {
      tags: {
        "fetch-api-response": "fail",
        url,
      },
    });
    throw error;
  },
  onSuccess: ({ url, response }) => {
    _logger.debug("FETCH API SUCCESS", { url, response });
  },
  onError: ({ url, error }) => {
    _logger.error("FETCH API ERROR", { url, error });
    _sentry.captureException(error, {
      tags: {
        "fetch-api-call": "fail",
        url,
      },
    });
    throw error;
  },
});

/* ****************************************************************************
 *
 * BOOT XMTP CLIENT
 *
 * ****************************************************************************/

const envForXmtp = _env({
  name: "env-for-xmtp",
  zEnv: z.object({
    XMTPB_BRIDGE_ADDRESS: z.string(),
  }),
});

const getPk = async () => {
  const config = await _prisma.bridge.findFirstOrThrow({
    where: { ethAddress: envForXmtp.XMTPB_BRIDGE_ADDRESS },
  });

  return config.bootKey;
};

const createXmtpClient = XmtpClient.createInterface({
  getPk,
  onCreateClient: () => {
    _logger.debug("XMTP CLIENT CREATED");
  },
  onCreateWallet: ({ address }) => {
    _logger.debug("XMTP WALLET CREATED", { address });
  },
  onCreateWalletError: ({ error }) => {
    _logger.error("XMTP WALLET CREATE ERROR", { error });
    _sentry.captureException(error, {
      tags: {
        "xmtp-wallet-create": "fail",
      },
    });
    throw error;
  },
  onCreateClientError: ({ error }) => {
    _logger.error("XMTP CLIENT CREATE ERROR", { error });
    _sentry.captureException(error, {
      tags: {
        "xmtp-client-create": "fail",
      },
    });
    throw error;
  },
  onSuccess: ({ client }) => {
    _logger.debug("XMTP CLIENT SUCCESS", { client });
  },
  onError: ({ error }) => {
    _logger.error("XMTP CLIENT ERROR", { error });
    _sentry.captureException(error, {
      tags: {
        "xmtp-client-interface": "fail",
      },
    });
    throw error;
  },
});

/* ****************************************************************************
 *
 * BOOT XMTP SEND INTERFACE
 *
 * ****************************************************************************/

const _xmtpSend = XmtpSend.createInterface({
  createClient: createXmtpClient,
  onCreateConversation: ({ conversation }) => {
    _logger.debug("XMTP CONVERSATION CREATED", { conversation });
  },
  onCreateConversationError: ({ address, conversationId, error }) => {
    _logger.error("XMTP CONVERSATION CREATE ERROR", {
      address,
      conversationId,
      error,
    });
    _sentry.captureException(error, {
      tags: {
        "xmtp-conversation-create": "fail",
        address,
        conversationId,
      },
    });
    throw error;
  },
  onSend: ({ toAddress, toConversationId, msg }) => {
    _logger.debug("XMTP MESSAGE SENT", { toAddress, toConversationId, msg });
  },
  onSendError: ({ toAddress, toConversationId, msg, error }) => {
    _logger.error("XMTP MESSAGE SEND ERROR", {
      toAddress,
      toConversationId,
      msg,
      error,
    });
    _sentry.captureException(error, {
      tags: {
        "xmtp-message-send": "fail",
        toAddress,
        toConversationId,
      },
    });
    throw error;
  },
  onSuccess: ({ toAddress, toConversationId, msg }) => {
    _logger.debug("XMTP MESSAGE SUCCESS", { toAddress, toConversationId, msg });
  },
  onError: ({ toAddress, toConversationId, msg, error }) => {
    _logger.error("XMTP MESSAGE ERROR", {
      toAddress,
      toConversationId,
      msg,
      error,
    });
    _sentry.captureException(error, {
      tags: {
        "xmtp-message-interface": "fail",
        toAddress,
        toConversationId,
      },
    });
    throw error;
  },
});

/* ****************************************************************************
 *
 * BOOT XMTP HANDLER INTERFACE
 *
 * ****************************************************************************/

const _xmtpHandler = XmtpHandler.createInterface({
  onAcceptMessage: ({ msg }) => {
    _logger.debug("XMTP MESSAGE ACCEPTED", { msg });
  },
  onAcceptedMessageError: ({ msg, error }) => {
    _logger.error("XMTP ACCEPTED MESSAGE ERROR", { msg, error });
    _sentry.captureException(error, {
      tags: {
        "xmtp-accepted-msg": "fail",
        msg: msg.id,
      },
    });
    throw error;
  },
  onHandlerError: ({ msg, error }) => {
    _logger.error("XMTP HANDLER ERROR", { msg, error });
    _sentry.captureException(error, {
      tags: {
        "xmtp-handler": "fail",
        msg: msg.id,
      },
    });
    throw error;
  },
  onHandlerResponse: ({ msg, response }) => {
    _logger.debug("XMTP HANDLER RESPONSE", { msg, response });
  },
  onHandlerResponseError: ({ msg, error }) => {
    _logger.error("XMTP HANDLER RESPONSE ERROR", { msg, error });
    _sentry.captureException(error, {
      tags: {
        "xmtp-handler-response": "fail",
        msgId: msg.id,
      },
    });
    throw error;
  },
  onSuccess: ({ msg }) => {
    _logger.debug("XMTP MESSAGE SUCCESS", { msg });
  },
  onError: ({ error }) => {
    _logger.error("XMTP MESSAGE ERROR", { error });
    _sentry.captureException(error, {
      tags: {
        "xmtp-message-interface": "fail",
      },
    });
    throw error;
  },
});

/* ****************************************************************************
 *
 * BOOT XMTP STREAM INTERFACE
 *
 * ****************************************************************************/

const _xmtpStream = XmtpStream.createInterface({
  createClient: createXmtpClient,
  onStreamCreated: () => {
    _logger.debug("XMTP STREAM CREATED");
  },
  onStreamCreateError: ({ error }) => {
    _logger.error("XMTP STREAM CREATE ERROR", { error });
    _sentry.captureException(error, {
      tags: {
        "xmtp-stream-create": "fail",
      },
    });
    throw error;
  },
  onMessage: ({ message }) => {
    _logger.debug("XMTP MESSAGE RECEIVED", { message });
  },
  onListenerError: ({ message, error }) => {
    _logger.error("XMTP LISTENER ERROR", { error });
    _sentry.captureException(error, {
      tags: {
        "xmtp-listener": "fail",
        msgId: message.id,
      },
    });
    throw error;
  },
  onError: ({ error }) => {
    _logger.error("XMTP STREAM ERROR", { error });
    _sentry.captureException(error, {
      tags: {
        "xmtp-stream-interface": "fail",
      },
    });
    throw error;
  },
});

/* ****************************************************************************
 *
 * EXPORT INTERFACES
 *
 * ****************************************************************************/

export const prisma = _prisma;
export const fetch = _fetch;
export const logger = _logger;
export const env = _env;
export const xmtpClient = createXmtpClient;
export const xmtpSend = _xmtpSend;
export const xmtpStream = _xmtpStream;
export const xmtpHandler = _xmtpHandler;
