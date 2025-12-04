import { describe, it, expect } from "bun:test";

import { ib } from "~/.";

describe("ib", () => {
  it("should work (it does not)", async () => {
    const data = await ib.getItem("Water");
    expect(data.text).toBe("Water");
  });
});
