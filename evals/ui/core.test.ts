import test from "node:test";
import assert from "node:assert/strict";
import { parseGuideRequest, makePair } from "./core.ts";
test("new guide generation requires explicit approval and a bounded prompt", () => {
  assert.equal(
    parseGuideRequest({ prompt: "Make a guide", approved: false })._tag,
    "Err",
  );
  assert.equal(parseGuideRequest({ prompt: "", approved: true })._tag, "Err");
  assert.equal(
    parseGuideRequest({ prompt: "a".repeat(12001), approved: true })._tag,
    "Err",
  );
  assert.deepEqual(
    parseGuideRequest({ prompt: " Make a guide ", approved: true }),
    { _tag: "Ok", prompt: "Make a guide" },
  );
});
test("a blind pair keeps text and private attribution together through either order", () => {
  for (const swap of [true, false]) {
    const pair = makePair(
      "case",
      "original",
      [
        { variant: "skill", text: "one" },
        { variant: "baseline", text: "two" },
      ],
      swap,
    );
    assert.equal(
      pair.candidates.find((item) => pair.mapping[item.id] === "skill")?.text,
      "one",
    );
    assert.equal(
      pair.candidates.find((item) => pair.mapping[item.id] === "baseline")
        ?.text,
      "two",
    );
  }
});
