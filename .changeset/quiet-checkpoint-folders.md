---
"@ayulab/pi-rewind": patch
"@ayulab/pi-checkpoint": patch
---

Require an existing Git work tree before pi-rewind creates or restores file checkpoints, avoiding full-directory staging when Pi starts in a non-Git folder. Add a bounded repository probe that ignores inherited Git routing variables. Warn and pause automatic checkpoints when storage setup fails, allowing the agent to continue and retry after `/reload`.
