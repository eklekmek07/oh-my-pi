import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { isGitWorkTree } from "./git-work-tree";

const run = promisify(execFile);

describe("isGitWorkTree", () => {
  let tmpDir: string;
  let repoDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-git-work-tree-"));
    repoDir = path.join(tmpDir, "project with spaces");
    await run("git", ["init", repoDir]);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.doUnmock("node:child_process");
    vi.resetModules();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test("recognizes repository roots and subdirectories", async () => {
    const subDir = path.join(repoDir, "src", "nested");
    await fs.mkdir(subDir, { recursive: true });

    expect(await isGitWorkTree(repoDir)).toBe(true);
    expect(await isGitWorkTree(subDir)).toBe(true);
  });

  test("recognizes linked worktrees with a .git file", async () => {
    await run("git", [
      "-C",
      repoDir,
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "--allow-empty",
      "-m",
      "initial",
    ]);
    const linkedDir = path.join(tmpDir, "linked");
    await run("git", ["-C", repoDir, "worktree", "add", "-b", "linked", linkedDir]);

    expect((await fs.stat(path.join(linkedDir, ".git"))).isFile()).toBe(true);
    expect(await isGitWorkTree(linkedDir)).toBe(true);
  });

  test("rejects a non-repository directory even when it contains a repository", async () => {
    expect(await isGitWorkTree(tmpDir)).toBe(false);
  });

  test("rejects bare repositories and nonexistent directories", async () => {
    const bareDir = path.join(tmpDir, "bare.git");
    await run("git", ["init", "--bare", bareDir]);

    expect(await isGitWorkTree(bareDir)).toBe(false);
    expect(await isGitWorkTree(path.join(tmpDir, "missing"))).toBe(false);
  });

  test("ignores inherited Git routing and configuration variables", async () => {
    vi.stubEnv("GIT_DIR", path.join(repoDir, ".git"));
    vi.stubEnv("GIT_WORK_TREE", repoDir);
    vi.stubEnv("GIT_COMMON_DIR", path.join(repoDir, ".git"));
    vi.stubEnv("GIT_INDEX_FILE", path.join(tmpDir, "foreign-index"));
    vi.stubEnv("GIT_CONFIG_COUNT", "1");
    vi.stubEnv("GIT_CONFIG_KEY_0", "core.bare");
    vi.stubEnv("GIT_CONFIG_VALUE_0", "true");

    expect(await isGitWorkTree(tmpDir)).toBe(false);
    expect(await isGitWorkTree(repoDir)).toBe(true);
    expect(
      await fs.access(path.join(tmpDir, "foreign-index")).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
  });

  test("returns false when Git cannot be spawned", async () => {
    vi.stubEnv("PATH", path.join(tmpDir, "empty-path"));
    expect(await isGitWorkTree(repoDir)).toBe(false);
  });

  test("kills a hung Git probe after five seconds and returns false", async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const kill = vi.fn();
    const execFileMock = vi.fn((_command, _args, options, callback) => {
      setTimeout(() => {
        kill(options.killSignal);
        callback(new Error("timed out"), "true\n");
      }, options.timeout);
      return { kill };
    });
    vi.doMock("node:child_process", () => ({ execFile: execFileMock }));
    const { isGitWorkTree: probe } = await import("./git-work-tree");
    const pending = probe(repoDir);

    await vi.advanceTimersByTimeAsync(4_999);
    expect(kill).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toBe(false);
    expect(kill).toHaveBeenCalledWith("SIGKILL");
    expect(execFileMock).toHaveBeenCalledWith(
      "git",
      ["-C", repoDir, "rev-parse", "--is-inside-work-tree"],
      expect.objectContaining({ timeout: 5_000, killSignal: "SIGKILL" }),
      expect.any(Function),
    );
  });

  test("fails closed if spawning throws synchronously", async () => {
    vi.resetModules();
    vi.doMock("node:child_process", () => ({
      execFile: vi.fn(() => {
        throw new Error("spawn failed");
      }),
    }));
    const { isGitWorkTree: probe } = await import("./git-work-tree");
    expect(await probe(repoDir)).toBe(false);
  });
});
