# Adoption and paired evaluation

`tasks.json` fixes 20 host-level tasks (10 cases × native/Wevu). These are separate from automated contract tests and have **not** been scored as real user/product results.

Use fresh copies of the same official create-weapp-vite 3.0.1 native/Wevu templates, installed dependency lockfiles, the same host/model version, test AppID and DevTools version for each comparison. Record their versions alongside the results. The initial feature tasks start from the template; fault tasks start from the same working counter page with `#count` and `#increment`. For build-error, add a syntax error to that page's script; for runtime-error, make the increment handler empty. For cancellation, add a wait for an absent selector and cancel after the first recorded interaction. Never run these mutations against a production project.

Run each task under three modes: `host-only`, `direct-tools` (host + weapp-vite MCP), and `weapp-agent` (host + this service and Skill). Use a shared `trial` identifier for the same developer/project/task comparison, reset the project and runtime state between modes, and vary mode order. Preserve host transcripts, report IDs and screenshots outside version control. The human reviewing success must use the task's acceptance criterion, not just a tool's exit code.

Write an array of observed records to a local JSON file with these fields:

- `taskId`: ID from tasks.json.
- `trial`: anonymous paired trial identifier.
- `mode`: one of the three modes above.
- `outcome`: passed, failed or blocked; blocked remains in the completion-rate denominator.
- `durationSeconds`: total elapsed time, including recovery.
- `humanTakeovers`: count of human interventions beyond the initial prompt.
- `failureReason`: required for failed/blocked records.
- `cost`: optional measured amount in the same currency; omit when unavailable.

Run `node scripts/summarize-benchmark.mjs /absolute/path/to/results.json`. It reports completion rates and medians by mode, plus takeover reduction only for matched direct-tools/weapp-agent pairs where both outcomes passed. Zero baseline takeovers produce no percentage claim. Empty inputs produce no success claim. This script never contacts users or uploads data.

Pilot target: recruit 10 existing-ecosystem developers through explicit outreach, obtain permission before collecting project data, and review blockers weekly. Track first usable report time, weekly active developers (target 5 for three consecutive weeks), and paired takeover reduction (target 30%). These are adoption hypotheses, not current metrics. Prioritize reliability until the measured benefit over direct tools is clear.

Distribution checklist: publish the reviewed preview through the repository's release process; add optional links from ecosystem docs; demonstrate success/failure/environment-blocker flows; record one Codex and one other host's actual handshake and task transcript. This checkout does not modify another repository, publish a package, contact participants, or claim official marketplace inclusion.
