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
import * as Express from "./express.js";

type Request = {
  url: string;
  method: string;
  body: unknown;
};

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
    _logger.debug("ATTEMPTING TO CREATE INTERFACE FOR PROCESS-ENV");
  },
  onCreateError: (err) => {
    _logger.error("ERROR WHILE CREATING INTERFACE FOR PROCESS-ENV", { err });
  },
  onRead: ({ name }) => {
    _logger.debug("READING INTERFACE FOR PROCESS-ENV", {
      description: name,
    });
  },
  onReadError: ({ error, name }) => {
    _logger.error("ERROR WHILE READING INTERFACE FOR PROCESS-ENV", {
      error,
      description: name,
    });
  },
  onError: ({ name, error }) => {
    _logger.error("UNCAUGHT ERROR WITHIN INTERFACE FOR PROCESS-ENV", {
      error,
      description: name,
    });
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
  onQuery: ({ operation, model, args }) => {
    _logger.debug("ATTEMPTING QUERY VIA PRISMA INTERFACE", {
      operation,
      model,
      args,
    });
  },
  onQueryError: ({ operation, model, args, error }) => {
    _logger.error("ERROR DURING PRISMA INTERFACE QUERY", {
      operation,
      model,
      args,
      error,
    });
    _sentry.captureException(error, {
      tags: { "prisma-query": `${model}-${operation}` },
    });
    throw error;
  },
});

/* ****************************************************************************
 *
 * BOOT FETCH
 *
 * ****************************************************************************/

const _fetch = Fetch.createInterface({
  onFetch: ({ name, url, init }) => {
    _logger.debug("ATTEMPTING TO FETCH", { name, url, init });
  },
  onFetchError: ({ name, url, status, error }) => {
    _logger.error("ERROR WHILE FETCHING", {
      description:
        "The request itself failed (as opposed to a 4XX or 5XX response)",
      name,
      url,
      status,
      error,
    });
    _sentry.captureException(error, {
      tags: { "fetch-api-call": "fail", url },
    });
    throw error;
  },
  onResponse: ({ name, url, json }) => {
    _logger.debug("FETCH GOT A RESPONSE", {
      name,
      url,
      json,
    });
  },
  onFailureStatus: ({ name, url, status, error }) => {
    _logger.error("FETCH RESPONSE STATUS WAS NOT 2XX", {
      name,
      url,
      status,
      error,
    });
    _sentry.captureException(error, {
      tags: { "fetch-api-response": "fail", url },
    });
    throw error;
  },
  onResponseValidationError: ({ name, url, error }) => {
    _logger.error("FETCH JSON VALIDATION ERROR", { name, url, error });
    _sentry.captureException(error, {
      tags: { "fetch-api-response": "fail", url },
    });
    throw error;
  },
  onSuccess: ({ name, url, json }) => {
    _logger.debug("FETCH WAS A SUCCESS", { name, url, json });
  },
  onError: ({ name, url, error }) => {
    _logger.error("UNCAUGHT ERROR INSIDE FETCH INTERFACE", {
      name,
      url,
      error,
    });
    _sentry.captureException(error, {
      tags: { "fetch-api-call": "fail", url },
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
    _logger.debug("ATTEMPTING TO CREATE XMTP CLIENT");
  },
  onCreateWallet: ({ address }) => {
    _logger.debug("WALLET FOR XMTP CLIENT CREATED", { address });
  },
  onCreateWalletError: ({ error }) => {
    _logger.error("FAILED TO CREATE WALLET FOR XMTP CLIENT", { error });
    _sentry.captureException(error, { tags: { "xmtp-wallet-create": "fail" } });
    throw error;
  },
  onCreateClientError: ({ error }) => {
    _logger.error("XMTP CLIENT CREATION FAILED", { error });
    _sentry.captureException(error, { tags: { "xmtp-client-create": "fail" } });
    throw error;
  },
  onSuccess: ({ client }) => {
    _logger.debug("XMTP CLIENT CREATED SUCCESS", {
      client: {
        address: client.address,
      },
    });
  },
  onError: ({ error }) => {
    _logger.error("UNCAUGHT ERROR IN XMTP CLIENT INTERFACE", { error });
    _sentry.captureException(error, {
      tags: { "xmtp-client-interface": "fail" },
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
    _logger.debug("XMTP SEND INTERFACE -- CREATED CONVERSATION TO SEND IN", {
      conversation: {
        peerAddress: conversation.peerAddress,
        context: {
          conversationId: conversation.context?.conversationId,
        },
      },
    });
  },
  onCreateConversationError: ({ address, conversationId, error }) => {
    _logger.error(
      "XMTP SEND INTERFACE -- FAILED TO CREATE CONVERSATION TO SEND IN",
      {
        address,
        conversationId,
        error,
      }
    );
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
    _logger.debug("XMTP SEND INTERFACE -- ATTEMPTING TO SEND MESSAGE", {
      toAddress,
      toConversationId,
      msg,
    });
  },
  onSendError: ({ toAddress, toConversationId, msg, error }) => {
    _logger.error("XMTP SEND INTERFACE -- FAILED TO SEND MESSAGE", {
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
    _logger.debug("XMTP SEND INTERFACE -- SUCCESS SENDING MESSAGE", {
      toAddress,
      toConversationId,
      msg,
    });
  },
  onError: ({ toAddress, toConversationId, msg, error }) => {
    _logger.error("XMTP SEND INTERFACE -- UNCAUGHT ERROR", {
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
  onAcceptMessage: ({ name, msg }) => {
    _logger.debug("XMTP HANDLER ACCEPTED MESSAGE", {
      description: name,
      msg: {
        id: msg.id,
        senderAddress: msg.senderAddress,
      },
    });
  },
  onAcceptedMessageValidationError: ({ name, msg, error }) => {
    _logger.error(
      "XMTP HANDLER ACCEPTED MESSAGE BUT CONTENT FAILED VALIDATION",
      {
        description: name,
        msg: { id: msg.id, senderAddress: msg.senderAddress },
        error,
      }
    );
    _sentry.captureException(error, {
      tags: {
        "xmtp-accepted-msg": "fail",
        messageId: msg.id,
      },
    });
    throw error;
  },
  onHandlerError: ({ name, msg, error }) => {
    _logger.error("XMTP HANDLER IMPL THREW AN ERROR", {
      description: name,
      msg: { id: msg.id },
      error,
    });
    _sentry.captureException(error, {
      tags: {
        "xmtp-handler": "fail",
        msg: msg.id,
      },
    });
    throw error;
  },
  onHandlerResponse: ({ name, msg, response }) => {
    _logger.debug("XMTP HANDLER IMPL RETURNED A VALUE", {
      description: name,
      msg: { id: msg.id },
      response,
    });
  },
  onSuccess: ({ name, msg }) => {
    _logger.debug("XMTP HANDLER SUCCESS", {
      description: name,
      msg: { id: msg.id },
    });
  },
  onError: ({ name, error }) => {
    _logger.error("UNCAUGHT ERROR INSIDE XMTP MESSAGE HANDLER", {
      description: name,
      error,
    });
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
  onAddListener: ({ name }) => {
    _logger.debug("XMTP STREAM ADD LISTENER", { name });
  },
  onMessage: ({ message }) => {
    _logger.debug("XMTP STREAM RECEIVED MESSAGE", {
      message: {
        id: message.id,
        senderAddress: message.senderAddress,
        content: message.content,
      },
    });
  },
  onListenerError: ({ name, message, error }) => {
    _logger.error("XMTP STREAM -- LISTENER THREW AN ERROR", { name, error });
    _sentry.captureException(error, {
      tags: {
        "xmtp-listener": name,
        msgId: message.id,
      },
    });
  },
  onError: ({ error }) => {
    _logger.error("UNCAUGHT ERROR INSIDE XMTP STREAM", { error });
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
 * BOOT EXPRESS
 *
 * ****************************************************************************/

const onRequest = ({ req }: { req: Request }) => {
  _logger.debug("EXPRESS HANDLER GOT A REQUEST", {
    url: req.url,
    method: req.method,
    body: req.body,
  });
};

const onSuccess = ({ req, result }: { req: Request; result: unknown }) => {
  _logger.debug("EXPRESS HANDLER RETURNED A RESPONSE", {
    url: req.url,
    method: req.method,
    result,
  });
};

const onBodyValidationError = ({
  req,
  error,
}: {
  req: Request;
  error: unknown;
}) => {
  _logger.error("EXPRESS HANDLER GOT AN INVALID BODY", {
    url: req.url,
    method: req.method,
    error,
  });
  _sentry.captureException(error, {
    tags: {
      "inbound-body-validation-error": "fail",
      url: req.url,
      method: req.method,
    },
  });
};

const onResponseValidationError = ({
  req,
  result,
  error,
}: {
  req: Request;
  result: unknown;
  error: unknown;
}) => {
  _logger.error("EXPRESS HANDLER IMPL RETURNED AN INVALID VALUE", {
    url: req.url,
    method: req.method,
    result,
    error,
  });
  _sentry.captureException(error, {
    tags: {
      "outbound-response-validation-error": "fail",
      url: req.url,
      method: req.method,
    },
  });
};

const onHandlerError = ({ req, error }: { req: Request; error: unknown }) => {
  _logger.error("UNCAUGHT ERROR INSIDE EXPRESS HANDLER", {
    url: req.url,
    method: req.method,
    error,
  });
  _sentry.captureException(error, {
    tags: {
      "server-error": "fail",
      url: req.url,
      method: req.method,
    },
  });
};

const _express = Express.createInterface({
  onRequest,
  onSuccess,
  onBodyValidationError,
  onResponseValidationError,
  onHandlerError,
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
export const express = _express;
