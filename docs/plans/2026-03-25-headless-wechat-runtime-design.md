# Headless WeChat Runtime Design

Date: 2026-03-25

## Summary

Introduce a test-first headless mini-program runtime that executes built mini-program artifacts directly and replaces most runtime assertions currently living under `e2e/ide/**`.

The runtime is designed to be DevTools-compatible in behavior where current repository tests depend on that behavior, but it is not a full replacement for the WeChat DevTools product. The focus is a deterministic, scriptable runtime kernel for pages, routing, lifecycle, `setData`, events, and runtime log collection.

The long-term target is:

- most daily runtime regression checks run on headless runtime
- a small DevTools smoke suite remains as compatibility canaries
- full DevTools regression runs become an exception, not the default inner loop

## Goals

- Replace most runtime assertions in `e2e/ide/**` with a headless runtime provider.
- Execute real built artifacts instead of a dedicated test-only compilation target.
- Keep behavior as close to WeChat DevTools as practical for page-centric runtime semantics.
- Provide a testing bridge that is close to the current `miniprogram-automator` usage model.
- Greatly reduce local validation time, DevTools hangs, and environment-driven flakiness.
- Preserve runtime warning, error, and exception reporting as a first-class regression signal.

## Non-goals

- Do not build a full replacement for the WeChat DevTools GUI.
- Do not attempt full `wx.*` coverage in phase one.
- Do not cover upload, preview, login, service-port management, or IDE-only workflows.
- Do not promise full parity with every host-specific, visual, or native-component edge case.
- Do not introduce a parallel test-only artifact format or IR.
- Do not attempt plugin, payment, auth, filesystem, or other heavy platform capability simulation first.

## Why This Exists

Current DevTools runtime e2e already shows the limits of the current approach:

- DevTools runtime tests are isolated into dedicated suites and configs.
- Many tests share `launchAutomator()` and chain cases through `reLaunch()`.
- The automation layer already needs warmup, retry, infra preflight, and runtime log wrappers.
- DevTools runs remain slow, single-host, and prone to hanging.

That indicates the main bottleneck is not Vitest itself. The bottleneck is the DevTools-dependent runtime validation layer.

The proposed runtime addresses this by replacing most uses of DevTools for page-level runtime verification while preserving a small number of real DevTools canary tests to catch drift.

## Scope

Phase one scope is explicitly page-centric. It focuses on the runtime semantics needed by the current repository's `e2e/ide/**` runtime assertions.

Included:

- project loading from built outputs
- `App/Page/Component` registration and host wiring
- page stack and route transitions
- page lifecycle execution
- core component lifecycle and observer behavior needed by existing tests
- `setData`-driven observable updates
- event dispatch and `triggerEvent`
- logical view-tree query and snapshotting
- runtime warning/error/exception capture

Excluded in phase one:

- broad `wx` API parity
- GUI workflows
- real rendering or visual pixel parity
- complex native component behavior
- plugin and open capability environments

## Core Product Decision

The runtime must execute built outputs directly.

This is a hard requirement. The repository's highest-value runtime regressions are often caused by the interaction between:

- compile output
- app/page/component registration
- route loading
- runtime lifecycle order

If the headless runtime consumes anything other than the actual built artifact shape, it stops being a meaningful replacement for `e2e/ide/**`.

## Architecture

The implementation is split into five layers.

### 1. Project Loader

Responsible for:

- reading `project.config.json` and `project.private.config.json`
- resolving `miniprogramRoot`
- loading built `app.json`
- resolving `pages`, `subPackages`, and route-to-entry mappings
- identifying which script/template/style assets belong to each route

It answers one question only: how should this project be loaded as a runnable mini-program?

### 2. Host Runtime

Provides the host-side global environment required by built outputs:

- `App`
- `Page`
- `Component`
- `getApp`
- `getCurrentPages`
- minimal `wx` subset and injectable host mocks
- global registration registries

This layer should emulate host contracts, not page logic.

### 3. Execution Engine

Responsible for:

- app bootstrapping
- page instance creation and teardown
- component instance creation and teardown
- lifecycle scheduling
- route-stack management
- `setData`
- observer and lifetime ordering
- event dispatch
- `triggerEvent`

This is the highest-risk compatibility layer and should be treated as the runtime kernel.

### 4. Logical View Tree

Maintains a queryable, deterministic, non-visual representation of the page state.

It exists for assertions, not visual rendering. It must support:

- node lookup
- text inspection
- attribute and dataset inspection
- event targeting
- page snapshots

This becomes the headless replacement for most structure-level DevTools assertions.

### 5. Testing Bridge

Exposes the runtime to `e2e` through an API that is intentionally close to the current automator usage model:

- launch
- route changes
- page handle access
- node queries
- runtime log collection
- session close

The testing bridge should minimize test migration cost.

## Proposed Package Layout

Create a standalone workspace:

- `mpcore`

Suggested internal layout:

```text
mpcore/
  package.json
  packages/
    core/
      package.json
      src/
        index.ts
    simulator/
      package.json
      src/
        project/
        host/
        runtime/
        view/
        testing/
      test/
```

Keep e2e-side integration thin:

- `e2e/utils/runtimeProvider.ts`
- `e2e/utils/automator.headless.ts`

The heavy logic should live in the package, not inside `e2e/`.

## Compatibility Targets

Phase one should aim for compatibility with the behaviors most heavily depended on by current runtime tests.

### App and Page Wiring

- correct `App()` singleton registration
- route-to-page binding
- page stack bookkeeping
- page instance visibility and current-page resolution

### Page Lifecycles

- `onLoad`
- `onShow`
- `onReady`
- `onHide`
- `onUnload`

These hooks should behave deterministically under route transitions, especially `reLaunch()`.

### Component Lifecycles and Observers

Support only the subset needed by current repository runtime assertions first:

- key `lifetimes`
- property initialization
- observer scheduling
- event emission through `triggerEvent`

### Data Update Semantics

`setData` must update both:

- observable page/component data
- logical view tree state used by test assertions

Correctness matters more than optimization in the first phase.

### Routing Semantics

Priority order:

1. `reLaunch`
2. `navigateTo`
3. `redirectTo`
4. `switchTab`
5. `navigateBack`

`reLaunch()` is the highest-value operation because the current DevTools suites rely on it heavily.

### Event Semantics

Support:

- node-level event dispatch
- `dataset`
- `detail`
- `target`
- `currentTarget`
- component `triggerEvent`

### Runtime Diagnostics

The runtime must capture:

- warning
- error
- exception

The reporting model should stay close to existing DevTools runtime reporting so that regression signals remain comparable.

## Deferred Compatibility Areas

These areas should not block the initial rollout:

- full `wx.*` surface
- plugin runtime
- auth and account state
- filesystem
- network environment fidelity
- native visual rendering details
- DevTools-only GUI or IDE flows

For unsupported APIs, prefer:

- explicit failure
- injectable mocks
- narrow compatibility shims

Avoid silent fake behavior that hides real gaps.

## Testing Interface

The external testing surface should be intentionally familiar.

```ts
interface LaunchOptions {
  projectPath: string
  cwd?: string
  provider?: 'headless'
  timeout?: number
  collectRuntimeLogs?: boolean
}

interface MiniProgramSession {
  reLaunch: (route: string) => Promise<PageHandle>
  navigateTo: (route: string) => Promise<PageHandle>
  redirectTo: (route: string) => Promise<PageHandle>
  switchTab: (route: string) => Promise<PageHandle>
  navigateBack: (delta?: number) => Promise<PageHandle | null>

  currentPage: () => Promise<PageHandle | null>
  getCurrentPages: () => Promise<PageHandle[]>

  getRuntimeLogs: () => RuntimeLogEntry[]
  clearRuntimeLogs: () => void
  close: () => Promise<void>
}

interface PageHandle {
  route: () => string
  data: <T = Record<string, any>>() => Promise<T>

  $: (selector: string) => Promise<NodeHandle | null>
  $$: (selector: string) => Promise<NodeHandle[]>

  waitFor: (timeoutMs?: number) => Promise<void>
  snapshot: () => Promise<LogicalPageSnapshot>
}

interface NodeHandle {
  text: () => Promise<string>
  attr: (name: string) => Promise<string | undefined>
  dataset: () => Promise<Record<string, any>>
  property: (name: string) => Promise<any>

  tap: (detail?: Record<string, any>) => Promise<void>
  trigger: (eventName: string, detail?: Record<string, any>) => Promise<void>

  $: (selector: string) => Promise<NodeHandle | null>
  $$: (selector: string) => Promise<NodeHandle[]>
}
```

The goal is not API elegance. The goal is migration leverage.

## Logical View Tree Model

The logical tree should represent mini-program observable structure rather than HTML DOM fidelity.

```ts
interface LogicalPageSnapshot {
  route: string
  data: Record<string, any>
  root: LogicalNode
  warnings: RuntimeLogEntry[]
  errors: RuntimeLogEntry[]
}

interface LogicalNode {
  kind: 'page' | 'component' | 'element' | 'text'
  tag: string
  id?: string
  classList?: string[]
  attrs: Record<string, string>
  dataset: Record<string, any>
  text?: string
  visible?: boolean
  children: LogicalNode[]
  componentName?: string
  eventBindings?: {
    name: string
    handler: string
  }[]
}
```

Phase one selector support should stay intentionally small and stable:

- tag
- `#id`
- `.class`
- `[data-x="y"]`
- component name
- descendant lookup

Do not spend phase-one effort on full CSS selector compatibility.

## E2E Integration Strategy

Migration should happen through provider abstraction, not by rewriting all tests at once.

### Step 1. Unify Launch Entry

Refactor current e2e runtime launch to go through a provider facade instead of directly depending on `miniprogram-automator`.

Target:

- tests call a shared runtime launcher
- the launcher dispatches to `devtools` or `headless`

### Step 2. Dual-Run Representative Cases

Pick a small set of representative tests and run them against both providers:

- `wevu runtime` cases
- template runtime cases
- selected `github-issues` runtime cases

The goal is to build a compatibility-gap map, not to declare full readiness immediately.

### Step 3. Add Headless Suites

Introduce dedicated configs and suite entries such as:

- `e2e/vitest.e2e.headless.config.ts`
- `ide-headless-smoke`
- `ide-headless-gate`

Keep current DevTools smoke suites in place as canaries.

### Step 4. Migrate by Dependency Profile

Migrate first:

- lifecycle-heavy page tests
- `setData` and interaction tests
- page structure and runtime-error assertions

Defer:

- plugin-heavy cases
- host-API-heavy cases
- tests that intentionally validate DevTools-only behavior

## MVP Plan

The MVP should prove runtime viability quickly instead of chasing broad platform coverage.

### Milestone 1. Runtime Boot

Deliver:

- project loader
- minimal host runtime
- app boot
- page boot
- `reLaunch`
- page lifecycle execution
- runtime log collection

Validation target:

- one small built app such as `e2e-apps/base`

### Milestone 2. Observable State

Deliver:

- `setData`
- logical view tree
- basic selectors
- event dispatch
- page snapshots

Validation target:

- a small set of page-structure and interaction assertions

### Milestone 3. Dual-Run Calibration

Deliver:

- headless provider in e2e
- representative test dual-run
- documented compatibility gaps

Validation target:

- selected `wevu runtime`
- selected template runtime
- selected `github-issues` runtime cases

### Milestone 4. Default Fast Path

Deliver:

- headless smoke and gate suites
- local fast-path documentation
- CI path split between headless and DevTools canaries

Validation target:

- most daily runtime checks move to headless
- DevTools smoke remains small and reliable

## Success Criteria

The project should be considered successful when all of the following are true:

- headless runtime can replace most `e2e/ide/**` runtime assertions
- local validation time is materially lower than the current DevTools loop
- hangs and environment-driven flakes are substantially reduced
- runtime warnings, errors, and exceptions remain visible and actionable
- a small real DevTools canary suite continues to agree with headless results on representative cases

## Risks

### 1. Built Artifact Loading Drift

If built outputs are loaded in a way that differs from the actual mini-program host contract, the whole runtime becomes untrustworthy.

Mitigation:

- keep loader logic explicit
- validate against real DevTools canaries early
- avoid hidden fallback behavior

### 2. `setData` and Logical Tree Drift

If observable tree state diverges from runtime data updates, tests will pass or fail for the wrong reasons.

Mitigation:

- treat tree rebuilding as correctness-first
- validate snapshots against representative DevTools cases

### 3. Lifecycle and Event Ordering Gaps

Small ordering differences can invalidate the runtime for real regression work.

Mitigation:

- prioritize lifecycle and routing parity over API breadth
- drive fixes from dual-run mismatches

### 4. Scope Explosion

If the project tries to emulate the whole platform too early, it will stall.

Mitigation:

- keep phase one page-centric
- require every new compatibility feature to justify itself via existing e2e needs

### 5. False Confidence

A headless runtime without real DevTools comparison will drift over time.

Mitigation:

- permanently retain a small DevTools smoke suite as canaries
- treat provider disagreement as a release signal

## Open Questions

- How much component observer and lifetime behavior is required for the first migration batch?
- Which current `e2e/ide/**` files should be chosen as the initial dual-run canaries?
- Should runtime provider selection be test-file-driven, suite-driven, or env-driven first?
- Which unsupported `wx` APIs need first-class injectable mocks to unblock representative tests?

## Recommendation

Proceed with a standalone headless runtime package and a provider-based e2e integration path.

Do not attempt full DevTools replacement.

Do replace the majority of page-centric runtime assertions with a direct-artifact, DevTools-compatible headless provider, and retain a small real DevTools suite for long-term calibration.
