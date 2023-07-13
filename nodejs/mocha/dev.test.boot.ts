import { z } from "zod";
import * as Console from "../src/console.js";
import * as Process from "../src/process.js";
import * as Fetch from "../src/fetch.js";
import * as Prisma from "../src/prisma.js";
import * as XmtpSend from "../src/xmtp-send.js";
import * as XmtpClient from "../src/xmtp-client.js";
import * as XmtpStream from "../src/xmtp-stream.js";
import * as XmtpHandler from "../src/xmtp-handler.js";
import { Wallet } from "@ethersproject/wallet";

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
  zEnv: z.object({}),
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
    throw error;
  },
  onResponseValidationError: ({ name, url, error }) => {
    _logger.error("FETCH JSON VALIDATION ERROR", { name, url, error });
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
    throw error;
  },
});

/* ****************************************************************************
 *
 * BOOT XMTP CLIENT
 *
 * ****************************************************************************/

const getPk = async () => {
  return Wallet.createRandom().privateKey;
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
    throw error;
  },
  onCreateClientError: ({ error }) => {
    _logger.error("XMTP CLIENT CREATION FAILED", { error });
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
    throw error;
  },
  onHandlerError: ({ name, msg, error }) => {
    _logger.error("XMTP HANDLER IMPL THREW AN ERROR", {
      description: name,
      msg: { id: msg.id },
      error,
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
    throw error;
  },
  onAddListener: ({ name }) => {
    _logger.debug("XMTP STREAM ADD LISTENER", { name });
  },
  onMessage: ({ message, listeners }) => {
    _logger.debug("XMTP STREAM RECEIVED MESSAGE", {
      listeners,
      message: {
        id: message.id,
        senderAddress: message.senderAddress,
        content: message.content,
      },
    });
  },
  onListenerError: ({ name, error }) => {
    _logger.error("XMTP STREAM -- LISTENER THREW AN ERROR", { name, error });
  },
  onError: ({ error }) => {
    _logger.error("UNCAUGHT ERROR INSIDE XMTP STREAM", { error });
    throw error;
  },
});

/* ****************************************************************************
 *
 * EXPORT INTERFACES
 *
 * ****************************************************************************/

export const fetch = _fetch;
export const logger = _logger;
export const prisma = _prisma;
export const env = _env;
export const xmtpClient = createXmtpClient;
export const xmtpSend = _xmtpSend;
export const xmtpStream = _xmtpStream;
export const xmtpHandler = _xmtpHandler;
