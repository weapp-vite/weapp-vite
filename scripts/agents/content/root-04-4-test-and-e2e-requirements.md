## 4. Tests and Runtime Acceptance

- Co-locate tests as `*.test.ts` / `*.spec.ts` and update snapshots with behavior. Before adding or changing a test, follow the [test authoring and retention rules](CONTRIBUTING.md#文档与测试审查).
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
