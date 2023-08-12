import { z } from "zod";
import { sXmtpPublish } from "../src/stack/xmtp-publish.js";
import { sXmtpSubscribe } from "../src/stack/xmtp-subscribe.js";
import { sConfig } from "../src/stack/config.js";
import { sFetch } from "../src/stack/fetch.js";
import { sInvariant } from "../src/stack/invariant.js";

/* We sleep for a few seconds to make sure that not only is the server up and
 * running but that it is the most recent version of the code. Depending on how
 * build steps work out, it's possible that the test file is reuilt and running before
 * the prior version of the server is shut down. */
await new Promise((resolve) => setTimeout(resolve, 3000));

describe("Smoke tests", () => {
  it("Ping the canary to make sure it's up", async () => {
    const response = await fetch("ping the canary")(
      sConfig.endToEnd().canaryHost + "/canary",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bridgeAddress: "TEST BRIDGE",
          message: {
            senderAddress: "TEST SENDER",
            content: "TEST CONTENT",
            conversation: {
              peerAddress: "TEST PEER",
            },
          },
        }),
      }
    );

    const json = await invariant("response.json() works")(async () =>
      response.json()
    )();

    const data = await invariant("canary response is the expected shape")(
      async () => zCanaryResponse.parse(json)
    )();

    await invariant("canary message is the expected string")(async () =>
      zCanaryMessage.parse(data.message)
    )();
  });

  it("Ping the webhook to make sure it's up", async function () {
    this.timeout(5000);

    const response = await fetch("ping the webhook")(
      sConfig.endToEnd().webhookHost + "/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bridgeAddress: sConfig.endToEnd().bridgeAddress,
          targetAddress: sConfig.xmtp().address,
          message: "WEBHOOK MESSAGE",
        }),
      }
    );

    const json = await invariant("response.json() works")(async () =>
      response.json()
    )();

    await invariant("webhook response is the expected shape")(async () =>
      zWebhookResponse.parse(json)
    )();
  });

  it("Send a message to bridge, check that it was sent to canary", async function () {
    this.timeout(10000);

    const randomContent = `${Math.random()}${Math.random()}${Math.random()}`;

    publish("send a message to bridge")({
      toAddress: sConfig.endToEnd().bridgeAddress,
      message: randomContent,
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const response = await fetch("check canary logs")(
      sConfig.endToEnd().canaryHost + "/logs",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const json = await invariant("response.json() works")(async () =>
      response.json()
    )();

    const data = await invariant("canary log response is the expected shape")(
      async () => zCanaryLogs.parse(json)
    )();

    await invariant("response contains the message sent by the test bridge")(
      async () => {
        const found = data.some((message) => {
          return message.content === randomContent;
        });

        z.literal(true).parse(found);
      }
    )();
  });

  it("Send a webhook, check that it was sent to bridge and forwarded to target", async function () {
    this.timeout(15000);

    let received = false;

    const content = `${Math.random()}${Math.random()}${Math.random()}`;

    subscribe("listen for message from webhook")({
      router: (message) => {
        return (
          message.senderAddress === sConfig.endToEnd().bridgeAddress &&
          message.content === content
        );
      },
      handler: async () => {
        received = true;
      },
    });

    await fetch("post to the webhook")(
      sConfig.endToEnd().webhookHost + "/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bridgeAddress: sConfig.endToEnd().bridgeAddress,
          targetAddress: sConfig.xmtp().address,
          message: content,
        }),
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 4000));

    await invariant("received was set to true")(async () =>
      z.literal(true).parse(received)
    )();
  });
});

const fetch = sFetch.create({
  feature: "smoke tests",
});

const invariant = sInvariant.create({
  feature: "smoke tests",
});

const publish = sXmtpPublish.create({
  feature: "smoke tests",
});

const subscribe = sXmtpSubscribe.create({
  feature: "smoke tests",
});

const zCanaryResponse = z.object({
  message: z.string(),
});

const zCanaryMessage = z.literal(
  "Hello from the canary, the bridge TEST BRIDGE sent the message TEST CONTENT"
);

const zWebhookResponse = z.object({ id: z.string(), message: z.string() });

const zCanaryLogs = z.array(z.object({ content: z.string() }));
