# AGENTS Guidelines (Global Baseline)

<!-- agents-generated: v1 -->
<!-- source: document:AGENTS.md; manifest-version: 1; generator-version: 1 -->

## Local Docs First

- Prefer repository-local documentation and generated package docs before relying on stale model memory or external pages.

## Local Overlay

- If `AGENTS.local.md` exists in this project or directory, read it after this file and apply its project-specific additions.
- Keep generated `AGENTS.md` files managed by the repository tooling; put user-owned custom rules in `AGENTS.local.md`.

This file defines repository-wide defaults for AI agents.
If a deeper directory contains its own `AGENTS.md`, apply that local file first, then fall back to this one.

## 1. Monorepo Routing

- Core bundler/compiler/runtime work:
  - `packages/weapp-vite`
  - `packages-runtime/wevu`
  - `packages-runtime/wevu-compiler`
  - `packages-runtime/weapi`
  - `packages-runtime/web`
  - `packages-runtime/web-apis`
  - related integration checks in `e2e/` and `e2e-apps/github-issues`
- Template/app parity work:
  - source app in `apps/*`
  - target template in `templates/*`
- Docs and site:
  - `website/`, `docs/`

Avoid cross-package edits unless the change is truly shared.

## 2. Build and Verification

- Install with `pnpm install`.
- Prefer the smallest proof that covers the change: targeted `pnpm vitest run <files>`, owning-package `typecheck` / `test:types`, then scoped builds. Use `pnpm test` or repository E2E only when their wider coverage is required.
- Use `pnpm build:pkgs`, `pnpm build:apps`, and `pnpm build:templates` for their corresponding scopes. Follow [CONTRIBUTING.md](CONTRIBUTING.md#pr-%E9%AA%8C%E8%AF%81) for the quick/review/full verification contract and CI handoff.

### 2.1 Keep `dist` Current

- Downstream apps, templates, E2E fixtures, published entrypoints, and CLI checks consume package `dist`, not live `src`. After changing `packages/*/src/**` or `packages-runtime/*/src/**`, rebuild every touched package before downstream validation. Rebuild again after later source edits.
- For changes under `packages/weapp-vite/src/cli/**`, `packages/weapp-vite/src/mcp.ts`, or another dependency of `dist/cli.mjs`, run `pnpm --filter weapp-vite build` before any `apps/*`, `templates/*`, or `e2e-apps/*` command. Before the downstream command, report `dist sync: rebuilt weapp-vite before downstream validation`. Then assert the specific downstream behavior or expected output.
- If downstream behavior does not reflect a recent source edit, rebuild the owning package and rerun the check once before deeper diagnosis.

### 2.2 Cross-Platform Changes

- Treat an OS-only matrix failure as a platform compatibility issue first when touching workflows, `e2e/scripts/**`, process launchers, filesystem utilities, path normalization, or shared scripts. Report `cross-platform suspect: checking command launch, path normalization, line endings, and filesystem assumptions before product logic`.
- Find the earliest divergent layer in `workflow -> package.json script -> Node wrapper -> child process`. Check Windows command resolution and quoting, native path separators and case, CRLF, temp-directory assumptions, executable bits, and deletion semantics before changing product logic.
- Prefer Node/TypeScript orchestration and `execa` for shared launchers. A raw `spawn` implementation must explicitly handle Windows `.cmd`, built-ins, quoting, and the minimal required `shell` boundary. Shared scripts must not depend on POSIX-only `&&`, inline environment assignment, permissions, or path shapes.
- Normalize persisted paths and snapshot/report labels to repo-relative POSIX form. Add the narrowest regression for the platform-sensitive primitive, rebuild package artifacts when applicable, and rerun the smallest affected workflow or job.

### 2.3 Long-Running Work

- Store a compact continuation index under `.tmp/current-run/<task>/` with goal/scope, authorization and object, base/head/worktree, commands and exit results, evidence, and remaining work. On resume, read the index and re-read current remote identity/state.
- Treat follow-up messages as steering the active task unless the user clearly cancels or replaces it. Existing authorization remains valid only for the same object and scope.
- Reuse successful checks only while their source, inputs, environment, and required gates remain unchanged. New failures, source changes, or missed gates require the affected check again.
- Partition parallel work by files, resources, and evidence. Run dependency-sensitive mutations and shared resources serially. Assign one monitor per CI, release, or E2E run and share its complete snapshot instead of polling or rerunning from multiple agents. Poll at ordinary intervals of at least 60 seconds.

## 3. Coding Rules

- Use TypeScript, ESM, 2-space indentation, kebab-case package names, camelCase variables/files, PascalCase classes/types, and named exports unless a file deliberately has one default owner.
- Never use Prettier in this repository. Use the applicable ESLint/Lefthook flow for code and Markdown, keep ESLint/Stylelint/TypeScript clean, and fix Stylelint issues in standalone styles and Vue `<style>` blocks. JSDoc comments must be Chinese.
- Fix the owning architecture and preserve a single source of truth. Avoid case-specific fallbacks, duplicate triggers, hidden coupling, or abstractions that exist only to make one test pass.
- Runtime markers, keys, and helper-name constants shared across packages or tests belong in `@weapp-core/constants` when they enter shipped code or require a stable cross-package contract.
- Final `dist`, mini-program, and plugin outputs must be persisted by Vite/Rolldown emit/write. Do not patch, synchronize, clean up, or restore bundle files with direct `writeFile` calls.
- If a source file exceeds 300 lines, evaluate a split and record the decision in PR notes. Prefer `foo/index.ts`, `foo/style.ts`, and `foo/helpers.ts` over dotted helper filenames.

### 3.1 Rust and Native Paths

- Treat JS ↔ Rust calls, serialization, and AST data movement as primary performance costs. Prefer one batch API that sends complete source/config/tasks, parses once, and returns structured results. Avoid per-query or per-node N-API traffic and JS callbacks from native traversal.
- Keep native AST acceleration optional and explicitly enabled. Loading, parsing, or native execution failures must fall back to the existing Babel/Oxc/Vue compiler path.
- Expand native coverage only with correctness parity tests and a real hot-path profile that shows stable net benefit after boundary costs. Preserve the JS/Oxc fallback during a POC.

## 4. Tests and Runtime Acceptance

- Co-locate tests as `*.test.ts` / `*.spec.ts` and update snapshots with behavior. Use [`$test-audit`](.agents/skills/test-audit/SKILL.md) when adding, changing, or removing tests.
- Package TypeScript changes start with the owning package `typecheck`. Consumer-visible public exports, reusable types, configuration builders, or runtime contracts also require the package's `test:types` coverage when available. Add or update `tsd` coverage when fixing a consumer-visible type regression.
- Narrow JSON from `fs.readJSON()` and similar APIs from `unknown` at the boundary. Diagnose broad root typecheck output by owning package before editing apps, templates, or generated output.
- Assert stable semantics such as public exports, explicit markers, relative paths, object shape, values, and call behavior. Do not bind bundle tests or snapshots to generated helper names, minified identifiers, hash suffixes, machine paths, usernames, PIDs, ports, or one-off report paths. Runtime-created isolated temp paths and representative absolute paths in explicit path-normalization tests are allowed.

### 4.1 Global E2E and Resource Ownership

- Every repository E2E entry is mutually exclusive on the same machine/user across worktrees, including `pnpm e2e*` and direct Vitest runs under `e2e/**`. Run them outside the sandbox and keep long IDE suites awake. Follow `$weapp-devtools-e2e-best-practices` and its [runtime checklist](skills/weapp-devtools-e2e-best-practices/references/runtime-e2e-checklist.md) before launching them.
- Acquire the repository machine lease and inspect active E2E, DevTools, automator, watcher, and verification-server ownership first. Wait for another task. Preserve manual and unknown-owner resources. Never use a process name, command substring, image name, alternate state directory, or global lock/session deletion to claim or clean resources.
- Cleanup, timeout, recovery, and teardown may release only resources recorded for the current session and still owned by it. Disposers must be idempotent, and an exited CLI PID is not a host PID. Preserve login data, user caches, unrelated projects, other installations, and borrowed parent leases.
- Concurrency or residual resources are the first suspect for flaky HMR, watch, DevTools, or automator failures. Do not change product logic or weaken an assertion until exclusivity is established.

### 4.2 Real DevTools and `mpcore` Parity

- Stable, reproducible behavior in real WeChat DevTools is the runtime source of truth. Login, port, automator, simulator boot, and protocol failures are infrastructure evidence, not product contracts or passing results.
- Default to the latest locally installed Stable. Record its channel/version, actual connected host, IDE/base-library versions, and official query evidence when available. Official lookup is advisory by default and blocks only when `--require-official-latest` or its environment equivalent explicitly enables strict mode. Use RC, nightly, development, old Stable, or another fixed installation only when the user selects it. Never switch versions to make a test pass.
- Freeze one explicit CLI/installation identity for preflight, launch, build, connection, recovery, and cleanup. Missing or logged-out local installations remain blocked. Do not migrate credentials or bypass login.
- A touched provider-compatible IDE scenario must run against DevTools and headless when supported. If reuse is impractical, add the narrowest equivalent owning `mpcore` unit/integration and browser E2E coverage, plus type-contract coverage for public types. Cover new, modified, or divergent `e2e/ide/**` scenarios in `mpcore` in the same change. Keep the real IDE assertion when the providers differ and repair `mpcore` to match.
- Changes to `mpcore/packages/simulator` observable runtime, public APIs/types, or test bridge keep its unit/integration, browser E2E, and `test-d` layers aligned. Prefer public scenario/route/snapshot/scope evidence over visual selectors or private call shape.
- Within one `e2e-app` suite, launch automator once and use `miniProgram.reLaunch(...)` between routes. An isolated relaunch needs a test comment explaining the requirement. Add every page to `project.private.config.json`. Every configured native page must emit the host-required files, and `project.config.json` must use a real AppID.
- Avoid host-reserved fixture/output names, including `__name__` directories and `donutAuthorize`. After a DevTools run, remove only task-owned generated reports and newline noise from the candidate diff.

### 4.3 Issue Fixes

- Start issue and feature work in a repository-local `.codex-tmp/<issue>` worktree based on current `origin/main`. Reproduce an issue with the user's supplied input in `e2e-apps/github-issues` or an equivalent real fixture before editing the owning package. Do not synthesize a substitute reproduction. Preserve copied source and configuration except for setting the E2E host identity to the repository's approved AppID. Never copy the user's AppID into the fixture.
- Identify the root cause, implement the owning fix, add the smallest unit/contract proof and end-to-end regression, rebuild touched package and downstream artifacts, then run headless before the corresponding real DevTools runtime scenario.
- Cover the reported main path, one material boundary, and final output paths/files. A runtime issue is complete only when the target real runtime observation passes. If infrastructure prevents that observation, record the environment failure and available provider coverage and state `未完成最终验收`.
- Full repository IDE acceptance runs only from a clean, current root `main` worktree. A task worktree may run its focused pre-merge issue suite but cannot claim the repository-wide acceptance result.
- Open the issue PR against main only after focused local proof. Follow the CI and review gates below. Remove the temporary worktree after merge.

### 4.4 Runtime Failure Handling

- Treat DevTools/local-listener sandbox errors such as `listen EPERM` as environment limitations first. Use Computer Use when the installed IDE's login, UI, simulator, project, or service-port state must be observed. Re-read application state after each UI action.
- Preserve the first launch/runtime error. A later `simulator launch success`, log rotation, or another window's readiness does not erase it. A generic `simulator launch failed` may remain pending only within the original launch budget and only when the same identified window later reaches `webview page ready`. Concrete initialization failures or budget expiry remain failures.
- Attempt at most one evidence-backed normal restart for the same host state. It requires the machine lease, verified installation/process/window identity, no manual work or other task resources, normal quit/reopen paths, and post-action checks. Never escalate to a global kill, clear credentials/cache, loop cold starts, prewarm, or retry navigation until green.
- Stop subsequent IDE suites after OOM, system kill, unknown ownership, uncertain launch receipt, or cleanup failure until the installation's process tree, ports, watchers, journal, snapshots, and lease reach a verified terminal state. Keep failure and recovery evidence separate.
- Known host defects and specialized cleanup/recovery details live in `$weapp-devtools-e2e-best-practices`. Apply that workflow when writing or running the relevant tests.

## 5. Commits, Pull Requests, and Releases

- Use Conventional Commits, for example `feat(weapp-vite): add css preprocess support`. Before each commit run the smallest staged lint plus applicable tests/builds. Never use Prettier. `lefthook.yml`, repoctl's native hook installer, staged typecheck/commitlint, ESLint, and Stylelint are the enforcement path. Lefthook may retain successful fixes in the index after a later failure, so inspect staged changes before retrying.
- Before review or push, run the smallest path/package-scoped lint, test, build, and generated-contract checks covering the diff. A pre-commit hook is not review evidence. Follow [CONTRIBUTING.md](CONTRIBUTING.md) for quick/review/full selection and repository-native push semantics.
- Default delivery is commit-only. Push only when requested. GitHub issue fixes are delivered through a PR to main, with post-merge worktree cleanup.
- PR titles, bodies, and follow-up reviews default to Chinese. GitHub-facing text must use repo-relative paths and reproducible commands. Never include local absolute paths, usernames, workspace/temp paths, machine-specific environment values, tokens, email addresses, or credentials.

### 5.1 Changesets

- Add a Chinese-summary changeset for user-visible/runtime/build behavior, public APIs/types, generated outputs, or template/app results. A source bug fix that changes real behavior requires one even when tests are the main diff.
- Do not add a changeset for docs, tests, comments, behavior-neutral refactors, or internal tooling alone. When a release changes `weapp-vite`, `wevu`, or `templates/*`, include the required `create-weapp-vite` bump.
- Follow `$release-and-changeset-best-practices` for intent classification, issue delivery, version preparation, and recovery.

### 5.2 PR CI and Approval

- Native `PR CI` checks are created for each PR open/reopen and new revision. Every revision needs its own `pr-ci-approval` Environment approval. Cancel old runs and never reuse an approval or result for a changed head. An AI may approve only the selected PRs and later revisions covered by explicit maintainer authorization, after re-verifying PR, run, and head. Authorization never transfers to another PR.
- Fork PRs keep the `all_external_contributors` review policy and require GitHub's review plus approval by an authorized maintainer/account. The Environment allows self-approval and does not allow administrator bypass. Closing a PR cancels its concurrency group through trusted default-branch `pull_request_target` logic without executing candidate code. Reopening requires fresh approval.
- Approval volume may focus runner capacity but must not introduce a global lock or fixed active-PR cap. Unrelated approved PRs may validate concurrently.
- Candidate code receives read-only permissions. Native job checks show progress. Trusted main-side reporting owns writes. Automatic comments run only for overall success. For a failed completed run, use the [default-branch completed-run report](docs/manual-pr-actions.md#原生运行的完成报告) after verifying its frozen revision and approval.
- Finish only after every applicable job/check, post-aggregation, status, and workflow reaches its expected terminal state. Match skips to their declared conditions. Missing, canceled, pending, or newly skipped checks do not pass. Bind evidence to PR, head/base, actual checkout/merge SHA, run ID, and attempt.

### 5.3 Release Safety

- `Automatic Release Intent` freezes PR data and policy from trusted main. Plan and apply need separate approvals. Preserve handwritten changesets and fork read-only behavior. A generated release commit is a new revision and must pass fresh PR approval and CI.
- Official version PRs may be repaired and pushed within the authorized task, but the user must perform the final merge that triggers production release. Do not auto-merge, join a merge queue, or publish directly.
- Before modifying or recovering a release, reconcile `pnpm change status`, target versions, frozen source commit and notes, `.changeset/ledger.yaml`, progress/checkpoint artifacts, and exact registry versions. A 404 or missing upload does not authorize changing frozen preparation metadata. Document late fixes already in the frozen source separately from frozen release notes. Reprepare or defer fixes outside that source.
- Preserve the first failure and registry state. Resume partial publication from the recorded source/checkpoint and upload only missing packages. Never overwrite a published version, upload different source under the same version, edit the ledger to fake consumption, or use an unrelated bump to hide failure.
- Release completion requires the current `plan → verify → prepare → upload → confirm → finalize` chain and verification of exact registry version, dist-tag, tarball/integrity, and internal dependency visibility. Command success or green PR CI alone is insufficient. Post-merge automatic Release workflows are recorded with their observed status but do not block later PR work.

## 6. Security and Environment

- Use Node.js `^22.23.4 || ^24.22.1 || >=26.12.1` with compatible pnpm for the repository and scaffolding. Vite+ templates require `^24.22.1 || >=26.12.1`. `weapp-ide-cli` open/preview/upload also requires the DevTools service port.
- Never commit secrets. Use `.env.local` or environment variables, and never expose credentials, cookies, tokens, private URLs, local identities, or machine paths in source, tests, fixtures, docs, PR text, or artifacts.
- Code that runs in a mini-program host must not depend on `eval`, `new Function`, `Function("return this")()`, string timers, or other dynamic evaluation. Resolve globals statically through explicit aliases, compile-time injection, or direct testable references.
- Before using `queueMicrotask`, Web/DOM/Node globals, or modern built-ins in host runtime code, probe existence and minimal semantics in the target real IDE AppService, base library, renderer, and platform. Browser, Node, types, and headless results do not replace that evidence. Use an explicit compatibility layer or the configured runtime-global injection.
- Mini-program runtime API ESLint rules apply only to source that enters AppService. Exclude build-time/CLI/test/Web-only/WXS code and generated output.

### 6.1 Workspace Hygiene

- Preserve `.vscode/settings.json` exclusions for generated, cache, dependency, coverage, temporary, report, and worktree directories. When adding such a directory, update the relevant file, watcher, search, Tailwind, and i18n exclusions.
- Keep `search.followSymlinks: false` unless a task explicitly needs linked content. Diagnose workspace CPU spikes by checking exclusion drift before changing language services, extensions, or product code.

## 7. Project Skills (Codex + Claude Code)

- Repository-owned skill sources live in `skills/*`. This index includes contributor workflows, not a default installation list:
  - `weapp-acceptance`
  - `docs-and-website-sync`
  - `release-and-changeset-best-practices`
  - `weapp-devtools-e2e-best-practices`
  - `native-to-weapp-vite-wevu-migration`
- Package-owned consumer skills are committed directly in their owner package and published from the same `skills/<name>/` tree:
  - `packages/weapp-vite/skills/`: `weapp-vite-best-practices`, `weapp-vite-vue-sfc-best-practices`
  - `packages-runtime/wevu/skills/`: `wevu-best-practices`
  - `packages-runtime/react/skills/`: `weapp-vite-react-best-practices`
  - `packages-runtime/json-render/skills/`: `wevu-json-render-best-practices`
  - `packages-runtime/a2ui/skills/`: `wevu-a2ui-best-practices`
- `skills/scripts/package-skills.mjs` discovers workspace package sources and root contributor sources. There is no root distribution registry, build-time copy, prepack generation, or generated package skill directory.

### Consumer projects

- Manual installation for a native project: `npx skills add sonofmagic/skills --skill weapp-vite-best-practices`. This works with npm, Yarn and older pnpm. Select SFC + Wevu or React skills for those stacks; migration is optional.
- Optional dependency installation (pnpm >=12.11.0): merge `skills: { dirs: [".agents/skills"] }` into `pnpm-workspace.yaml`, preserving team settings; run `pnpm install`, then interactive `pnpm approve`. Keep approval manual and let pnpm manage its links. Full commands, version differences and manual-entry safety: [AI Skills guide](https://vite.weapp.dev/guide/skills).

### Repository contributors

- This repo may also include project-specific Claude skills under `.claude/skills/*` (for example `playwright-cli`).
- `pnpm skills:link` will sync repository-owned `skills/*`, package-local consumer skills, and `.claude/skills/*` into local Codex/Claude skill directories.
- Internal maintainer skills are under `maintainers/skills/*`; do not expose them in user guidance.
- For local development and direct use of this checkout's skills in Codex and Claude Code (no global package install), run:
  - `pnpm skills:link`
- If you only need to preview linking behavior without changing local env, run:
  - `pnpm skills:link:dry`
