import { describe, it, expect } from "bun:test";

import { ib } from "~/.";

describe("ib", () => {
  it("should work (it does not)", async () => {
    const response = await ib.getItem("Water");
    console.log(response);
    expect(response.ok).toBeTrue();
    if (!response.ok) return;
    expect(response.data.text).toBe("Water");
  });
});
