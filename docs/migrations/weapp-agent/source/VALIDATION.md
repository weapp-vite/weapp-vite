# Preview validation

## Acceptance capability layer — 2026-09-30

The new model-free service is a local source change, not an npm release. The original preview record below remains historical evidence.

| Check                                                             | Result                     | Evidence / boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build/lint/typecheck/unit and integration tests/installed package | Passed locally             | Final pnpm validate passed: build, lint, typecheck, 65 tests and installed-package smoke. repo doctor passed 10 checks; repo check completed (no staged files). New coverage supplements the existing agent regressions.                                                                                                                                                                                                                                                                    |
| Installed stdio MCP                                               | Passed                     | A clean tarball installation completed a real SDK client handshake, listed five tools, started/polled a task and read its persisted version 2 report without model keys.                                                                                                                                                                                                                                                                                                                    |
| Skill packaging                                                   | Passed                     | Installed package copies SKILL.md and its scenario reference; an existing destination is not overwritten. Skill validator passed.                                                                                                                                                                                                                                                                                                                                                           |
| Native real DevTools acceptance                                   | Passed                     | Isolated official native fixture: counter 0→1, screenshots, console evidence, changed-scenario authorization rejection, injected assertion failure and corrected-scenario rerun. Reports under artifacts/acceptance-live/native.                                                                                                                                                                                                                                                            |
| Wevu real DevTools acceptance                                     | Partial; release gate open | Initial full counter task passed (artifacts/acceptance-live/passed.json). Subsequent builds failed during reLaunch. Latest report and screenshot/logs under artifacts/acceptance-live/wevu: route timeout and console TypeError `require_common.a is not a function` / `require_common.N is not a function`. Build and typecheck passed; runtime was correctly reported failed. Root cause in generated-vendor/runtime-cache consistency is not yet established. No assertion was weakened. |
| Twenty host-level evaluation tasks                                | Prepared, not measured     | benchmarks/tasks.json covers 10 tasks × native/Wevu. Metric aggregation was checked using synthetic data only, including empty and duplicate inputs.                                                                                                                                                                                                                                                                                                                                        |
| Actual Codex / second host end-to-end                             | Unverified                 | SDK protocol testing does not constitute a real Codex or second-host session. Official documentation access returned HTTP 403 in this session.                                                                                                                                                                                                                                                                                                                                              |
| Adoption, savings, Windows/Linux CI                               | Unverified                 | No participant outreach, usage claims, publication or remote CI execution in this change.                                                                                                                                                                                                                                                                                                                                                                                                   |

Reproduce the new runtime suite after building, in an **isolated disposable** installed fixture with a real test AppID, DevTools logged in/service port enabled, and pages/agent-proof/index exposing #count and #increment:

```sh
WEAPP_AGENT_ACCEPTANCE_FIXTURE=/absolute/disposable/fixture node scripts/acceptance-devtools.mjs
```

This deliberately replaces the fixture's agent configuration and acceptance-counter.json, injects an incorrect assertion, verifies rejection/failure, and restores the correct assertion. It does not modify production source or publish anything. The suite uses one MCP connection per acceptance task and reLaunch per scenario; it closes its own MCP subprocess, not the user's DevTools application. Headless/browser mocks and physical devices are not claimed as real DevTools evidence.

Source freshness uses content digests before/after execution and between checks/steps, plus a new digest when reports are read. Generated .weapp-vite support files, build output, dependencies, artifacts, caches and sensitive files are excluded. It is not a filesystem sandbox or an attestation of backend/remote data. A source change and exact restoration entirely between digest observations cannot be detected.

If a process exits while acquiring a lock before its owner record is written, or while recovering an abandoned lock, inspection may be required to remove that orphaned state-directory lock after confirming no task is active. The service deliberately refuses ambiguous ownership rather than running concurrent interactions.

## Original preview record

Validation performed on 2026-09-30 with Node.js 24.18.0 and pnpm 12.6.0. This is a source/packaged preview, not an npm publication.

| Check                       | Result                 | Evidence / boundary                                                                                                                            |
| --------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| repoctl bootstrap           | Passed                 | create-repoctl 1.0.5, CLI/tsdown templates; repo new; repo init                                                                                |
| repoctl doctor/check        | Passed                 | 10 doctor checks; staged check also runs at commit                                                                                             |
| Build, lint, typecheck      | Passed locally         | Five workspace packages; Nimbus lint 13 documents, Astro check 0 errors/warnings/hints                                                         |
| Deterministic tests         | Passed                 | 30 tests: tool loop, approvals, cancellation, recovery, compaction, provider streams, stdio/HTTP MCP, no Git textconv execution                |
| Standalone package          | Passed                 | Tarball installed in clean temporary project; help/init/verify work without private workspace packages                                         |
| Native + Wevu real projects | Passed                 | Official create-weapp-vite 3.0.1 templates, weapp-vite 7.4.0; add page, fail real build, repair, rebuild, check compiled route, resume session |
| Real WeChat DevTools        | Passed (native + Wevu) | One MCP connection shared across connect → reLaunch → counter tap (0 → 1) → screenshot → console log; no Web/headless substitute               |
| Native DevTools rerun       | Unverified             | Connection failed with DEVTOOLS_WS_CONNECT_ERROR; real build/repair acceptance passed, full runtime chain verified on Wevu                     |
| Nimbus browser QA           | Passed locally         | 1440px desktop, 390px mobile, no horizontal overflow, theme, navigation, search, no page errors                                                |
| Agent docs endpoints        | Passed locally         | llms.txt, llms-full.txt, Markdown page, sitemap                                                                                                |
| OpenAI real task            | Unverified             | API key and explicit live model unavailable in current environment                                                                             |
| Anthropic real task         | Unverified             | API key and explicit live model unavailable in current environment                                                                             |
| GitHub matrix / production  | Pending initial push   | CI checks Linux, macOS, Windows before deploying Static Assets                                                                                 |

## Reproduce

```sh
pnpm install --frozen-lockfile
pnpm validate
pnpm exec repo doctor
pnpm exec repo check
```

Live model validation: configure `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `WEAPP_AGENT_OPENAI_MODEL` and `WEAPP_AGENT_ANTHROPIC_MODEL`, then run `pnpm test:live`. Missing credentials produce unverified results and a failing exit code; provider-shaped mock streams are not real provider acceptance.

Create two **disposable** projects with `weapp-agent init --create --template native|wevu --model test`, install their dependencies, then set `WEAPP_AGENT_NATIVE_FIXTURE` and `WEAPP_AGENT_WEVU_FIXTURE` before running `pnpm test:fixtures`. The script adds `pages/agent-proof/index` and intentionally writes a syntax error before repairing it. Use fresh fixtures for each run.

For real runtime validation, configure a real test AppID and the `pages/agent-proof/index` launch condition in those fixtures. Log into WeChat DevTools and enable its service port. Set `WEAPP_AGENT_DEVTOOLS_FIXTURE` to one built fixture and run `pnpm test:devtools`. Run serially; the script shares one connection and uses reLaunch, then polls the rendered counter for completion. It requires screenshot and console evidence. Never run against a production business checkout. If using a system proxy, bypass localhost for the DevTools WebSocket. Reuse an existing project session where possible: forcing a fresh launch of an already open fixture produced DEVTOOLS_WS_CONNECT_ERROR; default connection reuse resolved it.

Reports and screenshots are generated under ignored `artifacts/`. No API keys, local session journals or developer credentials are committed.

## Known limits

- Real paid-model end-to-end acceptance remains open until keys and model names are available.
- Permissions are application checks, not an OS sandbox. Approved scripts run as the current OS user.
- Context compaction uses bounded excerpts, not a second model call; oversized call/result groups are summarized together and require rereading files.
- Dynamic Vite configuration is inferred rather than executed; inspect `project_info` and its warnings.
- Native fixture has no typecheck/test scripts; these categories remain unverified. Wevu's provided typecheck passed.
- ESLint emits advisory execa replacement warnings; execa is retained for cancellation and cross-platform process behavior. Astro emits dependency bundling directive warnings; build, typecheck and browser checks passed.

## Deployment compatibility

Wrangler is pinned to 4.95.0. Wrangler 4.143.1 uploaded assets but failed its subsequent `/workers/workers/` lookup with code 10007 on this account. The pinned version successfully deployed the same site and bound its custom domain. GitHub Actions uses the organization Cloudflare secrets and the same lockfile.

The static docs use normal page navigation with hover prefetch. Production browser testing found that the optional Astro client router did not remount the search dialog after navigating from the home page. Removing that optional router keeps search, theme and mobile navigation on a consistent document lifecycle.
