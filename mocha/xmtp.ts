import { z } from "zod";
import { sInvariant } from "../src/stack/invariant.js";
import { Wallet } from "@ethersproject/wallet";
import { Client } from "@xmtp/xmtp-js";

const invariant = sInvariant.create({ feature: "xmtp" });

describe("xmtp", () => {
  it("send a message", async () => {
    const toAddress = await invariant("process.env.TO_ADDRESS is a string")(
      async () => z.string().parse(process.env.TO_ADDRESS)
    )();

    const wallet = Wallet.createRandom();
    const client = await Client.create(wallet, { env: "production" });
    const conversation = await client.conversations.newConversation(toAddress);
    try {
      await conversation.send("hello world");
    } catch (err) {
      /* eslint-disable-next-line no-console */
      console.error(err);
    }
  });
});
