import test from "node:test";
import assert from "node:assert/strict";
import { parseGuideRequest, makePair, parseSamples } from "./core.ts";
test("sample approval identity changes when input or instructions change", () => {
  const source = {
    id: "case",
    label: "Guide",
    input: "One paragraph.",
    instructions: "Keep facts.",
  };
  const [original] = parseSamples([source]);
  assert.equal(original.words, 2);
  assert.equal(original.contentHash, parseSamples([source])[0].contentHash);
  assert.notEqual(
    original.contentHash,
    parseSamples([{ ...source, input: "Different paragraph." }])[0].contentHash,
  );
  assert.notEqual(
    original.contentHash,
    parseSamples([{ ...source, instructions: "Keep code." }])[0].contentHash,
  );
});
test("sample parsing rejects malformed entries and duplicate identities", () => {
  const source = {
    id: "case",
    label: "Guide",
    input: "Paragraph",
    instructions: "Keep facts.",
  };
  for (const value of [
    null,
    {},
    [null],
    [{ ...source, input: "" }],
    [{ ...source, label: 42 }],
    [source, source],
  ]) {
    assert.throws(() => parseSamples(value), /proposed-samples.json/);
  }
});
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
