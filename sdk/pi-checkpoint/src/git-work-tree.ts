import { execFile } from "node:child_process";

/**
 * Check whether cwd belongs to a real Git worktree without scanning its files.
 * Ignore inherited Git routing/configuration so checkpoint storage cannot be
 * mistaken for the user's repository. Git handles subdirectories and worktrees.
 */
export async function isGitWorkTree(cwd: string): Promise<boolean> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("GIT_")),
  );

  return new Promise((resolve) => {
    try {
      execFile(
        "git",
        ["-C", cwd, "rev-parse", "--is-inside-work-tree"],
        {
          env,
          timeout: 5_000,
          killSignal: "SIGKILL",
          maxBuffer: 1_024,
          encoding: "utf8",
          windowsHide: true,
        },
        (error, stdout) => resolve(error === null && stdout.trim() === "true"),
      );
    } catch {
      resolve(false);
    }
  });
}
