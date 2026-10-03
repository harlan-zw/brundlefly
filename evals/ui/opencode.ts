import { spawn, execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { extractText, hash } from "../core.ts";

export async function generate(
  prompt: string,
  model: string,
  scratch: string,
): Promise<string> {
  await mkdir(scratch, { recursive: true });
  const cacheFile = `${hash(model + "\n" + prompt)}.json`;
  if ((await readdir(scratch)).includes(cacheFile)) {
    const cached = JSON.parse(await readFile(join(scratch, cacheFile), "utf8"));
    if (cached.model !== model || cached.prompt !== prompt || cached.promptHash !== hash(prompt))
      throw Error("Cached generation differs from its request. Use a fresh scratch directory.");
    return extractText(cached.trace);
  }
  const isolated = await mkdtemp(join(scratch, "opencode-"));
  await mkdir(join(isolated, "config"));
  await mkdir(join(isolated, "cwd"));
  const supplied = process.env.EVAL_PROVIDER_CONFIG;
  const provider = supplied
    ? JSON.parse(await readFile(supplied, "utf8")).provider
    : undefined;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    XDG_CONFIG_HOME: join(isolated, "config"),
    OPENCODE_DISABLE_EXTERNAL_SKILLS: "1",
    OPENCODE_DISABLE_CLAUDE_CODE: "1",
    OPENCODE_DISABLE_CLAUDE_CODE_SKILLS: "1",
    OPENCODE_DISABLE_CLAUDE_CODE_PROMPT: "1",
    OPENCODE_CONFIG_CONTENT: JSON.stringify({
      provider,
      permission: "deny",
      share: "disabled",
      agent: {
        eval: {
          mode: "primary",
          prompt:
            "Follow the supplied guide request. Use no tools. Never claim you executed examples.",
          permission: "deny",
        },
      },
    }),
  };
  delete env.OPENCODE_CONFIG;
  delete env.OPENCODE_CONFIG_DIR;
  const executable = process.env.OPENCODE_BIN ?? "opencode";
  try {
    const trace = await new Promise<string>((accept, reject) => {
      const child = spawn(
        executable,
        [
          "run",
          "--pure",
          "--agent",
          "eval",
          "--format",
          "json",
          "--dir",
          join(isolated, "cwd"),
          "--model",
          model,
        ],
        { cwd: join(isolated, "cwd"), env },
      );
      let stdout = "";
      let stderr = "";
      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        reject(Error("Generation exceeded ten minutes."));
      }, 600000);
      child.stdout.on("data", (data) => {
        stdout += data;
      });
      child.stderr.on("data", (data) => {
        stderr += data;
      });
      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timeout);
        code === 0
          ? accept(stdout)
          : reject(Error(`OpenCode failed (${code}). ${stderr.slice(-500)}`));
      });
      child.stdin.end(prompt);
    });
    const sessionID = JSON.parse(trace.trim().split("\n")[0]).sessionID;
    const session = JSON.parse(
      execFileSync(executable, ["export", "--pure", sessionID], {
        env,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
    const users = session.messages.filter(
      (item: { info: { role: string } }) => item.info.role === "user",
    );
    const actual = users[0]?.parts
      .filter((part: { type: string }) => part.type === "text")
      .map((part: { text: string }) => part.text)
      .join("");
    if (users.length !== 1 || actual?.trim() !== prompt.trim())
      throw Error("OpenCode did not preserve the isolated prompt.");
    const text = extractText(trace);
    await writeFile(
      join(scratch, cacheFile),
      JSON.stringify({
        model,
        prompt,
        promptHash: hash(prompt),
        text,
        trace,
        date: new Date().toISOString(),
      }),
      { mode: 0o600 },
    );
    return text;
  } finally {
    await rm(isolated, { recursive: true, force: true });
  }
}
