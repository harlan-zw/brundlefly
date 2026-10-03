import { marked } from "marked";
import DOMPurify from "dompurify";
import mermaid from "mermaid";
type Pair = {
  id: string;
  kind: "writing" | "guide";
  original: string;
  candidates: { id: string; text: string }[];
  metadata?: { model: string; verification: string };
};
type Vote = {
  pair: Pair;
  choice: string;
  reason: string;
  checks: Record<string, string>;
  date: string;
  revealed?: Record<string, string>;
};
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const key = "brundlefly-reviews-v1";
let votes: Record<string, Vote> = {},
  pairs: Pair[] = [],
  checks: string[][] = [],
  mode: "writing" | "guide" = "writing",
  current = "",
  renderId = 0;
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "neutral",
  suppressErrorRendering: true,
});
const fail = (error: unknown) => {
  el("error").textContent =
    error instanceof Error ? error.message : String(error);
};
async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw Error(data.error ?? "Request failed.");
  return data;
}
const persist = () => localStorage.setItem(key, JSON.stringify(votes));
const filtered = () => pairs.filter((pair) => pair.kind === mode);
async function load() {
  const data = await api("/api/pairs");
  pairs = data.pairs;
  checks = data.guideChecks;
  if (!el<HTMLTextAreaElement>("prompt").value)
    el<HTMLTextAreaElement>("prompt").value = data.guidePrompt;
  el("evidence").textContent = data.guideEvidence;
  el("progress").textContent = `${Object.keys(votes).length} saved reviews`;
}
async function markdown(text: string, target: HTMLElement, token: number) {
  target.innerHTML = DOMPurify.sanitize(await marked.parse(text), {
    FORBID_TAGS: ["style", "iframe", "form", "input", "button"],
    FORBID_ATTR: ["style"],
  });
  target.querySelectorAll("a").forEach((link) => {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
  target.querySelectorAll("img").forEach((img) => {
    const url = new URL(img.getAttribute("src") ?? "", location.href);
    if (
      url.origin !== location.origin ||
      !url.pathname.startsWith("/evidence/")
    ) {
      const note = document.createElement("p");
      note.textContent = `Image placeholder: ${img.alt || "Screenshot not supplied"}`;
      img.replaceWith(note);
    }
  });
  for (const code of target.querySelectorAll("code.language-mermaid")) {
    if (token !== renderId) return;
    const source = code.textContent ?? "";
    if (
      !/^\s*(sequenceDiagram|flowchart\s+(TD|TB|LR|RL|BT))\b/.test(source) ||
      /%%\{|click\s|javascript:/i.test(source)
    )
      continue;
    const result = await mermaid
      .render(`diagram-${token}-${target.dataset.candidate}`, source)
      .then(
        (value) => ({ _tag: "Ok" as const, value }),
        () => ({ _tag: "Err" as const }),
      );
    if (token !== renderId) return;
    if (result._tag === "Ok") {
      const diagram = document.createElement("div");
      diagram.className = "diagram";
      diagram.innerHTML = DOMPurify.sanitize(result.value.svg, {
        USE_PROFILES: { svg: true, svgFilters: true },
      });
      code.parentElement!.replaceWith(diagram);
    } else {
      const note = document.createElement("p");
      note.textContent = "Diagram could not render. Its source remains below.";
      code.parentElement!.before(note);
    }
  }
}
async function render() {
  const token = ++renderId,
    list = filtered();
  if (!list.some((pair) => pair.id === current)) current = list[0]?.id ?? "";
  el("generator").hidden = mode !== "guide";
  el("review").hidden = !current;
  el("empty").hidden = !!current || mode !== "guide";
  const dropdown = el<HTMLSelectElement>("pair");
  dropdown.replaceChildren(
    ...list.map((pair, index) => {
      const option = document.createElement("option");
      option.value = pair.id;
      option.textContent = `${index + 1}. ${pair.kind === "guide" ? "Guide" : "Writing"} comparison`;
      return option;
    }),
  );
  dropdown.value = current;
  el("writing").setAttribute("aria-pressed", String(mode === "writing"));
  el("guides").setAttribute("aria-pressed", String(mode === "guide"));
  const pair = list.find((pair) => pair.id === current);
  if (!pair) return;
  const vote = votes[current];
  el("source-title").textContent =
    pair.kind === "guide" ? "Approved prompt" : "Original";
  el("original").textContent = pair.original;
  el("context").textContent =
    pair.kind === "guide"
      ? `${pair.metadata?.model}. ${pair.metadata?.verification}`
      : "Existing pilot outputs. Historical write-human-v1 versus Humanizer. Names stay hidden until you save a choice.";
  el("attribution").textContent = vote?.revealed
    ? Object.entries(vote.revealed)
        .map(([id, name]) => `${id}: ${name}`)
        .join(" · ")
    : "";
  el<HTMLButtonElement>("reveal").disabled = !vote;
  el("review-status").textContent = vote
    ? "Review saved. You can revise it."
    : "";
  el<HTMLTextAreaElement>("reason").value = vote?.reason ?? "";
  el("choices").replaceChildren(
    ...(pair.kind === "writing"
      ? ["A", "B", "original", "tie", "neither"]
      : ["A", "B", "tie", "neither"]
    ).map((value) => {
      const label = document.createElement("label"),
        input = document.createElement("input");
      input.type = "radio";
      input.name = "choice";
      input.value = value;
      input.checked = vote?.choice === value;
      label.append(
        input,
        value === "original"
          ? "Keep original"
          : value === "tie"
            ? "Tie"
            : value === "neither"
              ? "Neither"
              : `Version ${value}`,
      );
      return label;
    }),
  );
  el("outputs").replaceChildren();
  for (const candidate of pair.candidates) {
    const article = document.createElement("article");
    article.className = "candidate";
    const title = document.createElement("h2");
    title.textContent = `Version ${candidate.id}`;
    const prose = document.createElement("div");
    prose.className = "prose";
    prose.dataset.candidate = candidate.id;
    article.append(title, prose);
    el("outputs").append(article);
    await markdown(candidate.text, prose, token);
    if (token !== renderId) return;
    if (pair.kind === "guide") {
      const detail = document.createElement("details");
      detail.className = "checks";
      const summary = document.createElement("summary");
      summary.textContent = "Review guide completeness";
      detail.append(summary);
      for (const [name, question] of checks) {
        const check = `${candidate.id}:${name}`,
          label = document.createElement("label"),
          description = document.createElement("p"),
          select = document.createElement("select");
        label.textContent = name;
        description.textContent = question;
        select.dataset.check = check;
        select.setAttribute("aria-label", `Version ${candidate.id}: ${name}`);
        for (const value of [
          "Not reviewed",
          "Present",
          "Missing",
          "Unclear",
          "Not applicable",
        ]) {
          const option = document.createElement("option");
          option.textContent = value;
          select.append(option);
        }
        select.value = vote?.checks[check] ?? "Not reviewed";
        label.append(description, select);
        detail.append(label);
      }
      article.append(detail);
    }
  }
  el<HTMLButtonElement>("previous").disabled = list[0]?.id === current;
  el<HTMLButtonElement>("next").disabled = list.at(-1)?.id === current;
}
el("writing").onclick = () => {
  mode = "writing";
  void render().catch(fail);
};
el("guides").onclick = () => {
  mode = "guide";
  void render().catch(fail);
};
el("pair").onchange = () => {
  current = el<HTMLSelectElement>("pair").value;
  void render().catch(fail);
};
for (const [id, direction] of [
  ["previous", -1],
  ["next", 1],
] as const)
  el(id).onclick = () => {
    const list = filtered();
    current =
      list[list.findIndex((pair) => pair.id === current) + direction]?.id ??
      current;
    void render().catch(fail);
  };
el("save").onclick = () => {
  const choice = document.querySelector<HTMLInputElement>(
    "input[name=choice]:checked",
  )?.value;
  if (!choice) {
    el("review-status").textContent =
      "Choose a version, original, tie, or neither first.";
    return;
  }
  const pair = pairs.find((pair) => pair.id === current)!;
  votes[current] = {
    pair,
    choice,
    reason: el<HTMLTextAreaElement>("reason").value,
    date: new Date().toISOString(),
    checks: Object.fromEntries(
      [...document.querySelectorAll<HTMLSelectElement>("[data-check]")].map(
        (select) => [select.dataset.check!, select.value],
      ),
    ),
    revealed: votes[current]?.revealed,
  };
  try {
    persist();
    el("review-status").textContent = "Review saved in this browser.";
    el<HTMLButtonElement>("reveal").disabled = false;
    el("progress").textContent = `${Object.keys(votes).length} saved reviews`;
  } catch (error) {
    fail(error);
    el("review-status").textContent =
      "Storage failed. Export reviews before closing.";
  }
};
el("reveal").onclick = () => {
  void api(`/api/reveal?id=${encodeURIComponent(current)}`)
    .then((data) => {
      votes[current].revealed = data.mapping;
      persist();
      return render();
    })
    .catch(fail);
};
el("export").onclick = () => {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          reviews: Object.values(votes),
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "brundlefly-reviews.json";
  anchor.click();
  URL.revokeObjectURL(url);
};
let running = false;
const updateApproval = () => {
  el<HTMLButtonElement>("generate").disabled =
    running ||
    !el<HTMLInputElement>("approval").checked ||
    !el<HTMLTextAreaElement>("prompt").value.trim();
};
el("approval").onchange = updateApproval;
el("prompt").oninput = () => {
  el<HTMLInputElement>("approval").checked = false;
  updateApproval();
};
async function watch() {
  const job = await api("/api/job");
  if (job._tag === "Running") {
    running = true;
    updateApproval();
    el("generation-status").textContent =
      "OpenCode is generating both versions. This can take several minutes.";
    setTimeout(() => {
      void watch().catch(fail);
    }, 1500);
    return;
  }
  running = false;
  updateApproval();
  if (job._tag === "Failed")
    el("generation-status").textContent = `Generation failed: ${job.reason}`;
  if (job._tag === "Done") {
    el("generation-status").textContent =
      "Two drafts are ready. Examples still need technical verification.";
    await load();
    mode = "guide";
    current = job.pairId;
    await render();
  }
}
el("generate").onclick = () => {
  running = true;
  updateApproval();
  el("generation-status").textContent = "Starting OpenCode…";
  void api("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: el<HTMLTextAreaElement>("prompt").value,
      approved: el<HTMLInputElement>("approval").checked,
    }),
  })
    .then(() => {
      el<HTMLInputElement>("approval").checked = false;
      return watch();
    })
    .catch((error) => {
      running = false;
      updateApproval();
      fail(error);
      el("generation-status").textContent =
        "Generation did not start. Check the error below.";
    });
};
async function start() {
  const stored = localStorage.getItem(key);
  if (stored) votes = JSON.parse(stored);
  await load();
  await render();
  const job = await api("/api/job");
  if (job._tag === "Running") await watch();
}
void start().catch(fail);
