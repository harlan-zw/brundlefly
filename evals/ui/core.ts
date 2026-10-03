export type Pair = {
  id: string;
  original: string;
  kind: "writing" | "guide";
  candidates: { id: string; text: string }[];
  mapping: Record<string, string>;
  metadata?: Record<string, unknown>;
};
export function parseGuideRequest(
  value: unknown,
): { _tag: "Ok"; prompt: string } | { _tag: "Err"; reason: string } {
  if (!value || typeof value !== "object")
    return { _tag: "Err", reason: "Provide a prompt and approval." };
  const input = value as Record<string, unknown>;
  if (input.approved !== true)
    return {
      _tag: "Err",
      reason: "Approve this new evaluation before generation.",
    };
  if (
    typeof input.prompt !== "string" ||
    !input.prompt.trim() ||
    input.prompt.length > 12000
  )
    return {
      _tag: "Err",
      reason: "Use a prompt between 1 and 12000 characters.",
    };
  return { _tag: "Ok", prompt: input.prompt.trim() };
}
export function makePair(
  id: string,
  original: string,
  candidates: { variant: string; text: string }[],
  swap: boolean,
): Pair {
  if (candidates.length !== 2) throw Error("Provide two candidates.");
  const ordered = swap ? [...candidates].reverse() : candidates;
  return {
    id,
    original,
    kind: "writing",
    candidates: ordered.map((item, index) => ({
      id: index === 0 ? "A" : "B",
      text: item.text,
    })),
    mapping: Object.fromEntries(
      ordered.map((item, index) => [index === 0 ? "A" : "B", item.variant]),
    ),
  };
}
export const guidePrompt =
  "Explain HTTP cache revalidation to a developer who knows basic HTTP. Use a small Node 24 server to demonstrate ETag, If-None-Match, and 304. Include runnable code, a request-flow diagram, and instructions for capturing a browser Network-panel screenshot. Explain what the code, diagram, and screenshot prove. Cover prerequisites, expected results, and common mistakes. Keep it focused on one resource.";
export const guideEvidence = `Shared source context, checked 3 October 2026:
An ETag identifies a representation. A client can send If-None-Match with its stored ETag.
For GET or HEAD, a matching conditional request produces 304. The 304 response has no content body.
Cache-Control: no-cache allows storage but requires validation before reuse. no-store prevents storage.
A browser can combine a 304 network response with its cached body. A fetch Response can therefore expose status 200 even when the wire response was 304.
For browser inspection, leave DevTools Disable cache unchecked. Use an ordinary reload, not a hard reload.
Use .mjs for Node ES module code. Bind the demo to loopback. Limit the example to one fixed resource.
Use a Mermaid sequenceDiagram code block for the request flow. Do not claim examples were executed by you.
Do not invent a Network-panel image. Supply capture instructions and identify any image placeholder clearly.
Available real screenshot: /evidence/cache-requests.png. It shows the demo server's observed request log after browser navigation and ordinary reload: request 1 had no If-None-Match, status 200, 24 body bytes; request 2 sent "demo-v1", status 304, zero body bytes. Label this a demo request-log screenshot, not a DevTools screenshot. You may include it with Markdown image syntax. It verifies only the supplied fixture, not code you generate.
Official sources:
https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2
https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.5
https://httpwg.org/specs/rfc9111.html#cache-response-directive.no-cache
https://httpwg.org/specs/rfc9111.html#cache-response-directive.no-store
This source packet covers the approved cache topic only. Different topics need their own verified source context.`;
export const guideChecks = [
  ["Reader", "Who is this for, and what should they already know?"],
  ["Goal", "What will the reader be able to do or understand?"],
  ["Scope", "Which versions, assumptions, and limits apply?"],
  ["Explanation", "Are concepts introduced before they are used?"],
  ["Evidence", "Can material claims be traced to suitable sources?"],
  ["Understanding", "Can the reader check their understanding or result?"],
  [
    "Prerequisites",
    "For procedures: are tools, setup, and working directory clear?",
  ],
  ["Steps", "For procedures: is the common path ordered and complete?"],
  ["Example", "For procedures: are imports, files, and commands complete?"],
  [
    "Expected result",
    "For procedures: does the reader know what success looks like?",
  ],
  ["Recovery", "For procedures: are likely failures and fixes explained?"],
];
