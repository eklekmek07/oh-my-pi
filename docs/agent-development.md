# Agent development workflow

Load before implementing or checking code. Root AGENTS.md risk, safety, scope and
release boundaries apply to every operation.

## Commands

- Install: `mise install && pnpm install`
- Local check: `pnpm run check`
- CI gate: `pnpm run verify`
- Build: `pnpm run build`
- Release dry run: `pnpm run release:dry`

## Coding Rules

- Follow `CONTRIBUTING.md` for detailed code standards.
- TypeScript ESM. Prefer `unknown` over `any`. Avoid `any`, non-null `!`, and unsafe `as` in production code; prefer type guards and keep unavoidable assertions local to typed boundaries.
- In Pi extension runtime code, avoid `console.*`; use `ctx.ui.notify` for user-visible messages. CLI scripts and repo tooling may use `console.*` for terminal output.
- Use `node:path` and `path.relative` for paths; do not hard-code `/` separators.
- Extract shared runtime helpers to `internal/runtime-core`; promote stable public APIs to `sdk/`; keep domain-specific logic in the owning package until there is a second real consumer.
- For bug fixes, reproduce first when practical and add or adjust tests before the fix.

## Verification

- Prefer evidence over self-assessment: run `pnpm run check` or the relevant test suite before claiming completion.
- For bug fixes, reproduce the issue before fixing when practical; otherwise explain why reproduction was not possible.
- Report exact files changed, commands run and exact outcomes, tests or checks not run with reason, and any residual risk.
