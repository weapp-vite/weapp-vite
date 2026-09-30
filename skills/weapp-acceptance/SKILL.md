---
name: weapp-acceptance
description: Validate changes in weapp-vite native or Wevu WeChat projects with Weapp Agent build checks, deterministic DevTools scenarios, and source-bound evidence. Use after implementing a mini-program feature or investigating a failed acceptance task.
---

# Weapp acceptance

Keep planning and code edits in the host agent. Weapp Agent executes checks and collects evidence; it does not need another model or API key.

1. Call `weapp_project_inspect` when available, or `wv accept <project> --inspect --json`. Limit acceptance claims to supported weapp-vite native/Wevu projects on WeChat.
2. Maintain `acceptance.scenarios` in `weapp-acceptance.config.json` for the requested behavior. Read [scenarios.md](references/scenarios.md) when creating or changing a scenario. Preserve unrelated checks and user changes. Choose assertions from the requested outcome, not from whichever output the current code produces.
3. Start `weapp_acceptance_start`, retain its `jobId`, and query `weapp_acceptance_status` until it is no longer `running`. Use CLI `wv accept <project> --json` if MCP is unavailable; CLI waits for completion. Do not launch duplicate jobs to poll progress.
4. Read `weapp_acceptance_report` and relevant named artifacts. Repair the cause of failures within the user's task, then run a new acceptance job. Repeated environment failures require resolving the stated prerequisite, not repeated navigation or input.

Honor existing host authorization. A tool's `action_required` result does not authorize silently adding `--trust`. Explain the concrete scripts/configuration that need review. Scenario edits invalidate the stored trust decision. Never lower required checks, delete assertions, or replace actual values with expected values to obtain a pass.

Reports use `version: 2`. Claim acceptance passed only when `passed` is true and `snapshot.stale` is false; state the report's `requiredChecks`. Build-only acceptance is not runtime verification. `verify --json` is the legacy command report and is not a full acceptance verdict.

Report failures, missing evidence, and environment blockers distinctly. Screenshots support inspection but do not prove visual correctness. `runtime: wechat-devtools` describes the developer-tool simulator, not a physical device. Interrupted tasks are not replayed: inspect the last recorded step and current state before starting a fresh job.

When reporting completion, provide the job ID, checks performed, failed/unverified categories, and relevant screenshot/log artifacts. Do not claim a runtime action occurred unless the report records it.
