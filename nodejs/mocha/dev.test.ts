import { z } from "zod";
import * as Interfaces from "./dev.test.boot.js";
import { Wallet } from "@ethersproject/wallet";

/* ****************************************************************************
 *
 * The purpose of the dev test suite is to give a developer confidence that
 * their dev environment is up and running. Additionally, every failing test
 * should point the developer one step closer to getting their dev environment
 * up and running.
 *
 * The smoke tests work like this:
 *
 * 1. ping the canary to make sure it's up
 * 2. ping the webhook to make sure it's up
 * 3. send a message to bridge, check that it was sent to canary
 * 4. send a webhook, check that it was sent to bridge and forward to target
 *
 * ***************************************************************************/

const STATE = {
  canaryUrl: "http://localhost:8080/canary",
  canaryLogUrl: "http://localhost:8080/log",
  webhookUrl: "http://localhost:8081/send",
  bridgeAddress: "0x3c7AeA4749CD8f922d73902467037782D0bC42df",
} as const;

describe("Smoke tests", () => {
  it("Ping the canary to make sure it's up", async () => {
    const response = await Interfaces.fetch({
      name: "dev-test-canary",
      zResponse: z.object({
        message: z.string(),
      }),
    })(STATE.canaryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        bridgeAddress: "TEST BRIDGE",
        message: {
          senderAddress: "TEST SENDER",
          content: "TEST CONTENT",
          conversation: {
            peerAddress: "TEST PEER",
          },
        },
      },
    });

    Interfaces.logger.debug("DEV TEST CANARY RESPONSE", response);
  });

  it("Ping the webhook to make sure it's up", async function () {
    this.timeout(10000);
    const client = await Interfaces.xmtpClient();

    let received = false;

    Interfaces.xmtpStream(
      "listen-for-webhook",
      Interfaces.xmtpHandler({
        name: "webhook-ping-listener",
        predicate: () => true,
        zI: z.unknown(),
        impl: async () => {
          received = true;
        },
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 3000));

    Interfaces.fetch({
      name: "dev-test-webhook",
      zResponse: z.unknown(),
    })(STATE.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        bridgeAddress: client.address,
        targetAddress: "0xf89773CF7cf0B560BC5003a6963b98152D84A15a",
        message: "WEBHOOK MESSAGE",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    if (!received) {
      throw new Error("Did not receive webhook message");
    }
  });

  it("Send a message to bridge, check that it was sent to canary", async function () {
    this.timeout(10000);

    const randomContent = `${Math.random()}${Math.random()}${Math.random()}`;
    await Interfaces.xmtpSend({
      toAddress: STATE.bridgeAddress,
      msg: randomContent,
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const response = await Interfaces.fetch({
      name: "dev-test-canary",
      zResponse: z.array(
        z.object({
          content: z.string(),
        })
      ),
    })(STATE.canaryLogUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const sentByTestBridge = response.find((message) => {
      return message.content === randomContent;
    });

    if (sentByTestBridge === undefined) {
      throw new Error("Did not find message sent by test bridge");
    }
  });

  it("Send a webhook, check that it was sent to bridge and forwarded to target", async function () {
    this.timeout(10000);
    const client = await Interfaces.xmtpClient();

    let received = false;

    const content = `${Math.random()}${Math.random()}${Math.random()}`;

    Interfaces.xmtpStream(
      "listen-for-webhook",
      Interfaces.xmtpHandler({
        name: "dev-test-listen-for-webhook-messag",
        predicate: () => true,
        zI: z.unknown(),
        impl: async () => {
          received = true;
        },
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 3000));

    Interfaces.fetch({
      name: "webhook-forwarded-listener",
      zResponse: z.unknown(),
    })(STATE.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        bridgeAddress: STATE.bridgeAddress,
        targetAddress: client.address,
        message: content,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    if (!received) {
      throw new Error("Did not receive webhook message");
    }
  });
});

describe("Utils", () => {
  it("Get a random wallet", async () => {
    const wallet = Wallet.createRandom();
    Interfaces.logger.debug("CREATED BRIDGE CONFIG", {
      address: wallet.address,
      pk: wallet.privateKey,
    });
  });
});
