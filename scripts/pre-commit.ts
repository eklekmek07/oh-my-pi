#!/usr/bin/env oxnode
import { execFileSync } from "node:child_process";

// Git exports repository selectors to hooks; nested test repos must not inherit them.
const checkEnv = { ...process.env };
const gitLocalEnv = execFileSync("git", ["rev-parse", "--local-env-vars"], { encoding: "utf8" });
for (const name of gitLocalEnv.trim().split(/\s+/)) {
  delete checkEnv[name];
}

function run(command: string, args: readonly string[]): void {
  execFileSync(command, [...args], {
    stdio: "inherit",
    ...(command === "git" ? {} : { env: checkEnv }),
  });
}

function stagedFiles(): string[] {
  const output = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
    encoding: "utf8",
  });

  return output
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
}

const filesToRestage = stagedFiles();

run("pnpm", ["run", "fmt"]);
run("pnpm", ["run", "lint:fix"]);

if (filesToRestage.length > 0) {
  run("git", ["add", "--", ...filesToRestage]);
}

run("pnpm", ["run", "check"]);
