import { z } from "zod";
import fetch from "node-fetch";

describe("The server is running", () => {
  it("has a heartbeat", async () => {
    const response = await fetch(
      "http://api.relay.network/robot-maker/heartbeat"
    );
    z.number().gte(200).lt(300).parse(response.status);
  });
});
