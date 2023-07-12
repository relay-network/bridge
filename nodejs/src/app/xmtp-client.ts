import { Client } from "@xmtp/xmtp-js";
import { Wallet } from "@ethersproject/wallet";

export const createInterface = ({
  getPk,
  onCreateClient,
  onCreateWallet,
  onCreateWalletError,
  onCreateClientError,
  onSuccess,
  onError,
}: {
  getPk: () => Promise<string>;
  onCreateClient: () => void;
  onCreateWallet: ({ address }: { address: string }) => void;
  onCreateWalletError: ({ error }: { error: unknown }) => void;
  onCreateClientError: ({ error }: { error: unknown }) => void;
  onSuccess: ({ client }: { client: Client }) => void;
  onError: ({ error }: { error: unknown }) => void;
}) => {
  let client: Client | null = null;

  return async () => {
    if (client !== null) {
      return client;
    }

    // We assume that the getPk function is part of another interface, so we
    // don't need to instrument it.
    const pk = await getPk();

    try {
      onCreateClient();
    } catch (error) {
      onError({ error });
      throw new Error(
        "xmtp-client.ts :: createClient :: onError did not throw"
      );
    }

    const wallet = (() => {
      try {
        return new Wallet(pk);
      } catch (error) {
        onCreateWalletError({ error });
        throw new Error(
          "xmtp-client.ts :: createClient :: onCreateClientError did not throw"
        );
      }
    })();

    try {
      onCreateWallet({ address: wallet.address });
    } catch (error) {
      onError({ error });
      throw new Error(
        "xmtp-client.ts :: createClient :: onError did not throw"
      );
    }

    client = await (async () => {
      try {
        return await Client.create(wallet, { env: "production" });
      } catch (error) {
        onCreateClientError({ error });
        throw new Error(
          "xmtp-client.ts :: createClient :: onCreateClientError did not throw"
        );
      }
    })();

    try {
      onSuccess({ client });
    } catch (error) {
      onError({ error });
      throw new Error(
        "xmtp-client.ts :: createClient :: onError did not throw"
      );
    }

    return client;
  };
};
