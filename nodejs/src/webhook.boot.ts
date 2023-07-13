import { z } from "zod";
import * as Console from "./console.js";
import * as XmtpSend from "./xmtp-send.js";
import * as XmtpClient from "./xmtp-client.js";
import * as Process from "./process.js";
import * as Express from "./express.js";
import { Wallet } from "@ethersproject/wallet";

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
    XMTPB_WEBHOOK_PORT: z.string(),
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
};

const onHandlerError = ({ req, error }: { req: Request; error: unknown }) => {
  _logger.error("UNCAUGHT ERROR INSIDE EXPRESS HANDLER", {
    url: req.url,
    method: req.method,
    error,
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

export const logger = _logger;
export const env = _env;
export const xmtpClient = createXmtpClient;
export const xmtpSend = _xmtpSend;
export const express = _express;
