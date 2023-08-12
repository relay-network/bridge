import { Client } from "@xmtp/xmtp-js";
import { Wallet } from "@ethersproject/wallet";
import * as Config from "./1-config.js";
import * as Effect from "./2-effect.js";

const wallet = (() => {
  const effect = Effect.create({
    api: "boot-xmtp-client",
    feature: "boot-xmtp-client",
    request: "create a wallet",
    metadata: { address: Config.xmtp().address },
  });

  effect.attempt();

  const created = (() => {
    try {
      return new Wallet(Config.xmtp().key);
    } catch (err) {
      effect.failure(err, "new Wallet(key) threw an error");
      throw err;
    }
  })();

  effect.success();

  return created;
})();

export const client = await (async () => {
  const effect = Effect.create({
    api: "boot-xmtp-client",
    feature: "boot-xmtp-client",
    request: "init the xmtp client",
    metadata: { address: wallet.address },
  });

  effect.attempt();

  const created = await (async () => {
    try {
      return await Client.create(wallet, { env: Config.xmtp().environment });
    } catch (err) {
      effect.failure(err, "Client.create(wallet) threw an error");
      throw err;
    }
  })();

  effect.success();

  return created;
})();
