import type { ExecFileSyncOptions } from "node:child_process";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const execFileSync = vi.hoisted(() =>
  vi.fn((command: string, args: readonly string[], _options?: ExecFileSyncOptions) => {
    if (command === "git" && args[0] === "diff") return "a.ts\n" as never;
    if (command === "git" && args[0] === "rev-parse")
      return "GIT_DIR\nGIT_INDEX_FILE\nGIT_PREFIX\n" as never;
    return undefined as never;
  }),
);

vi.mock("node:child_process", () => ({
  execFileSync,
}));

describe("pre-commit script", () => {
  beforeEach(() => {
    vi.resetModules();
    execFileSync.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("isolates tool checks from the committing repository while preserving staging", async () => {
    vi.stubEnv("GIT_DIR", "/committing/repo.git");
    vi.stubEnv("GIT_INDEX_FILE", "/committing/index");
    vi.stubEnv("GIT_PREFIX", "nested/");
    vi.stubEnv("KEEP_CHECK_ENV", "preserved");

    await import("./pre-commit");

    expect(execFileSync).toHaveBeenCalledWith(
      "pnpm",
      ["run", "check"],
      expect.objectContaining({ env: expect.objectContaining({ KEEP_CHECK_ENV: "preserved" }) }),
    );
    for (const [, , options] of execFileSync.mock.calls) {
      if (options && "env" in options) {
        expect(options.env).not.toHaveProperty("GIT_DIR");
        expect(options.env).not.toHaveProperty("GIT_INDEX_FILE");
        expect(options.env).not.toHaveProperty("GIT_PREFIX");
      }
    }
    expect(process.env.GIT_INDEX_FILE).toBe("/committing/index");
    expect(execFileSync).toHaveBeenCalledWith("git", ["add", "--", "a.ts"], { stdio: "inherit" });
  });

  test("runs format, lint fix, restage, and check", async () => {
    await import("./pre-commit");

    expect(execFileSync).toHaveBeenCalledWith(
      "git",
      ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
      {
        encoding: "utf8",
      },
    );
    expect(execFileSync).toHaveBeenCalledWith(
      "pnpm",
      ["run", "fmt"],
      expect.objectContaining({ stdio: "inherit", env: expect.any(Object) }),
    );
    expect(execFileSync).toHaveBeenCalledWith(
      "pnpm",
      ["run", "lint:fix"],
      expect.objectContaining({ stdio: "inherit", env: expect.any(Object) }),
    );
    expect(execFileSync).toHaveBeenCalledWith("git", ["add", "--", "a.ts"], { stdio: "inherit" });
    expect(execFileSync).toHaveBeenCalledWith(
      "pnpm",
      ["run", "check"],
      expect.objectContaining({ stdio: "inherit", env: expect.any(Object) }),
    );
  });

  test("skips restaging when nothing changed", async () => {
    execFileSync.mockImplementation(((command: string, args: readonly string[]) => {
      if (command === "git" && args[0] === "diff") return "\n" as never;
      if (command === "git" && args[0] === "rev-parse")
        return "GIT_DIR\nGIT_INDEX_FILE\nGIT_PREFIX\n" as never;
      return undefined as never;
    }) as never);

    await import("./pre-commit");

    expect(execFileSync).not.toHaveBeenCalledWith("git", ["add", "--", "a.ts"], {
      stdio: "inherit",
    });
  });
});
