# Headless WeChat Runtime Implementation Plan

Date: 2026-03-25

Related design:

- `docs/plans/2026-03-25-headless-wechat-runtime-design.md`

## Summary

This plan turns the headless runtime design into a staged implementation roadmap for this repository.

The implementation strategy is:

1. keep the current DevTools runtime path intact
2. add a provider abstraction above the current runtime launch layer
3. build a standalone headless runtime package behind that abstraction
4. dual-run representative runtime tests against both providers
5. move most day-to-day runtime verification to headless while keeping a small DevTools canary suite

The plan deliberately prioritizes confidence and migration leverage over feature breadth.

## Delivery Principles

- Always execute built outputs directly.
- Keep headless runtime in a standalone package instead of embedding core logic in `e2e/`.
- Preserve a thin, provider-oriented e2e facade so existing tests can migrate gradually.
- Use dual-run mismatches to drive compatibility work.
- Keep real DevTools smoke tests as long-term canaries.

## Target Repository Changes

New workspace:

- `mpcore`

Expected new package structure:

```text
mpcore/
  package.json
  packages/
    simulator/
      package.json
      tsconfig.json
      src/
        index.ts
        project/
          index.ts
          loadProject.ts
          resolveRoutes.ts
        host/
          index.ts
          globals.ts
          appRegistry.ts
          pageRegistry.ts
          componentRegistry.ts
          wx.ts
        runtime/
          index.ts
          session.ts
          appInstance.ts
          pageInstance.ts
          componentInstance.ts
          router.ts
          lifecycle.ts
          setData.ts
          events.ts
        view/
          index.ts
          snapshot.ts
          selectors.ts
          nodeHandle.ts
        testing/
          index.ts
          launch.ts
          sessionHandle.ts
          pageHandle.ts
      test/
```

Expected e2e integration changes:

- `e2e/utils/runtimeProvider.ts`
- `e2e/utils/automator.headless.ts`
- `e2e/vitest.e2e.headless.config.ts`
- `e2e/scripts/e2e-suite-manifest.ts`

Expected later test migration touchpoints:

- selected `e2e/ide/**` files

## Phase 0: Preparation And Inventory

Goal:

- establish the migration surface before writing runtime code

Tasks:

- inventory current `e2e/ide/**` tests by dependency profile
- classify each test into:
  - page/runtime core
  - component/runtime core
  - heavy host API
  - DevTools-only
  - plugin/open capability
- identify the smallest representative dual-run canary set
- document the minimum automator APIs actually used by those canaries

Suggested output:

- a short matrix in the implementation PR description or follow-up note

Suggested candidate canaries:

- `e2e/ide/wevu-runtime.weapp.test.ts`
- `e2e/ide/template-weapp-vite-wevu-template.layouts.runtime.test.ts`
- one `e2e/ide/github-issues.runtime.*.test.ts` file with page-centric assertions

Exit criteria:

- initial canary set is fixed
- direct automator API surface used by canaries is enumerated
- unsupported test categories are explicitly deferred

## Phase 1: Provider Abstraction

Goal:

- decouple e2e tests from direct `miniprogram-automator` dependency

Tasks:

- introduce a runtime provider facade under `e2e/utils/`
- make provider selection env-driven first
- preserve current DevTools behavior as the default
- adapt existing launch helpers to route through the provider facade

Key deliverables:

- `e2e/utils/runtimeProvider.ts`
- a normalized interface for:
  - `launch`
  - `reLaunch`
  - `close`
  - page query
  - runtime log access

Suggested first provider values:

- `devtools`
- `headless`

Verification:

- existing DevTools runtime tests still pass unchanged when `provider=devtools`

Exit criteria:

- current test files no longer need to import provider-specific launch code directly
- provider switching can happen centrally

## Phase 2: Headless Package Skeleton

Goal:

- create a standalone package with compile-ready boundaries but minimal behavior

Tasks:

- add `mpcore/packages/simulator/package.json`
- wire package build/test scripts into the monorepo
- add public entrypoint exports
- add placeholder module boundaries matching the design
- add initial unit tests for loader and session bootstrap scaffolding

Verification:

- `pnpm --filter simulator build`
- `pnpm vitest run` scoped to the new package tests

Exit criteria:

- package builds cleanly
- public API surface is stubbed and type-checked
- unit-test harness exists for subsequent phases

## Phase 3: Project Loader MVP

Goal:

- load built mini-program projects deterministically from disk

Tasks:

- parse `project.config.json` and `project.private.config.json`
- resolve `miniprogramRoot`
- load built `app.json`
- resolve root pages and subpackage pages
- build route-to-entry metadata
- produce a normalized project descriptor consumed by the runtime session

Important constraints:

- do not fall back to source files
- fail explicitly when required built artifacts are missing

Suggested tests:

- route resolution for root pages
- route resolution for subpackages
- missing artifact failure cases
- config precedence around `miniprogramRoot`

Suggested fixtures:

- `e2e-apps/base`
- one subpackage-heavy `e2e-apps/*`

Exit criteria:

- project loader can produce a route map for representative built apps
- route loading behavior is covered by unit tests

## Phase 4: Host Runtime MVP

Goal:

- provide the minimum mini-program host contract required for app and page boot

Tasks:

- implement `App`, `Page`, `Component` registries
- implement `getApp`
- implement `getCurrentPages`
- implement minimal global boot environment
- add injectable `wx` shim with explicit unsupported behavior

Important constraints:

- avoid broad `wx` API expansion
- keep unsupported APIs loud and explicit

Suggested tests:

- singleton app registration
- page registration and lookup
- current page stack visibility
- unsupported `wx` API errors are explicit

Exit criteria:

- runtime can host built page modules without DevTools
- host registries are deterministic under repeated runs

## Phase 5: Runtime Session And `reLaunch` MVP

Goal:

- boot an app, create a page instance, and support `reLaunch()` end-to-end

Tasks:

- implement session bootstrap
- initialize app instance
- create page instances from route metadata
- maintain a page stack
- implement page teardown on `reLaunch`
- schedule `onLoad/onShow/onReady/onHide/onUnload`

Suggested tests:

- `reLaunch()` creates the correct page
- previous page is torn down
- lifecycle order is stable
- current page stack updates correctly

Suggested initial verification path:

- one dedicated package test using a built `e2e-apps/base` fixture

Exit criteria:

- headless runtime can launch and `reLaunch()` a built page successfully
- lifecycle ordering is covered by package tests

## Phase 6: `setData` And Observable State

Goal:

- make page data assertions meaningful

Tasks:

- implement `setData`
- track observable page data
- track component data required by canary tests
- ensure data reads from page handles observe post-update state

Important constraints:

- correctness before diff optimization
- no hidden mutation that bypasses observable state

Suggested tests:

- nested path updates
- array/object updates
- sequential updates
- page handle `data()` reflects latest observable state

Exit criteria:

- page data assertions are stable under representative interaction flows

## Phase 7: Event Dispatch MVP

Goal:

- support page and component interactions used by canary tests

Tasks:

- implement node-level event dispatch
- support `detail`
- support `target/currentTarget`
- support `dataset`
- implement component `triggerEvent`

Suggested tests:

- tap handler updates page data
- dataset is delivered correctly
- component-emitted events reach parent handlers

Exit criteria:

- representative interaction tests no longer depend on DevTools input dispatch

## Phase 8: Logical View Tree And Query Handles

Goal:

- replace structure-level DevTools assertions with a deterministic logical tree

Tasks:

- define logical node model
- build page snapshots
- implement `PageHandle.$()` and `PageHandle.$$()`
- implement `NodeHandle.text()`
- implement `NodeHandle.attr()`
- implement `NodeHandle.dataset()`
- implement basic selectors:
  - tag
  - `#id`
  - `.class`
  - `[data-x=\"y\"]`
  - descendant lookup

Important constraints:

- do not implement full CSS selector support in this phase
- keep snapshots stable and minimal

Suggested tests:

- text lookup
- id/class lookup
- dataset selector lookup
- snapshot stability under repeated runs

Exit criteria:

- canary tests can make structure assertions using headless page and node handles

## Phase 9: Runtime Log Collection

Goal:

- preserve runtime warnings, errors, and exceptions as a regression signal

Tasks:

- collect warning/error/exception entries in the headless session
- expose log retrieval and clearing
- align log summary format with existing e2e expectations where practical
- decide whether provider facade should normalize both providers to one reporting contract

Suggested tests:

- page runtime error is surfaced
- warning counts and error counts are queryable
- logs reset between sessions

Exit criteria:

- headless provider can fail or report on runtime issues with the same seriousness as DevTools

## Phase 10: First Dual-Run Canary Set

Goal:

- validate headless against real DevTools on representative cases

Tasks:

- add `e2e/vitest.e2e.headless.config.ts`
- introduce env-driven provider switching in selected test files or shared helpers
- run chosen canaries against:
  - `provider=devtools`
  - `provider=headless`
- collect mismatches in:
  - lifecycle order
  - route state
  - structure assertions
  - runtime logs

Suggested canary selection:

- `wevu-runtime` core route assertions
- one template runtime assertion set
- one github issue reproduction with page-centric behavior

Exit criteria:

- mismatch list exists and is small enough to tackle incrementally
- at least one non-trivial runtime case passes on both providers

## Phase 11: Compatibility Closure Loop

Goal:

- close the highest-value gaps exposed by dual-run calibration

Tasks:

- fix lifecycle ordering differences
- fix event payload differences
- fix view-tree visibility or selector mismatches
- add targeted package tests for each resolved mismatch
- resist feature creep unrelated to the canary mismatch set

Important constraints:

- every compatibility addition should be traceable to a concrete e2e need
- do not expand unsupported API surface opportunistically

Exit criteria:

- selected canary set is green on both providers
- package-level tests lock in resolved semantics

## Phase 12: Headless Smoke Suite

Goal:

- make headless the default fast runtime validation path

Tasks:

- add headless smoke suite entry to `e2e/scripts/e2e-suite-manifest.ts`
- document local commands
- wire CI or local scripts to run headless smoke before or instead of large DevTools suites

Suggested commands:

- `pnpm vitest run -c ./e2e/vitest.e2e.headless.config.ts <file>`
- `node --import tsx e2e/scripts/run-e2e-suite.ts ide-headless-smoke`

Exit criteria:

- local fast-path for runtime validation defaults to headless
- DevTools smoke remains available as a canary suite

## Phase 13: Broader Migration

Goal:

- move most suitable `e2e/ide/**` runtime assertions to headless

Tasks:

- migrate tests by dependency profile, not by folder order
- keep unsupported categories on DevTools
- add more headless suites only after the previous batch is stable

Migration order:

1. page lifecycle and route tests
2. `setData` and interaction tests
3. template/runtime structure assertions
4. selected github issue regressions

Defer:

- plugin-heavy tests
- host-API-heavy tests
- DevTools-specific tests

Exit criteria:

- majority of suitable runtime assertions run on headless
- remaining DevTools tests are intentionally small and justified

## Validation Matrix

Use the smallest validation step that proves each phase.

Package-level:

- `pnpm --filter simulator build`
- `pnpm vitest run <targeted package test files>`

Provider integration:

- targeted `pnpm vitest run -c ./e2e/vitest.e2e.headless.config.ts <file>`

Dual-run calibration:

- targeted run once with `provider=headless`
- targeted run once with `provider=devtools`

Do not default to all-runtime full-suite runs until the headless smoke path is stable.

## Suggested Task Breakdown For The First Implementation PRs

### PR 1

- add package skeleton
- add provider abstraction
- keep DevTools path unchanged

### PR 2

- implement project loader
- add loader unit tests

### PR 3

- implement host runtime plus session bootstrap
- support `reLaunch()` and page lifecycle MVP

### PR 4

- implement `setData`
- implement runtime logs
- add headless page handle data access

### PR 5

- implement logical view tree and basic selectors
- implement event dispatch MVP

### PR 6

- add headless Vitest config
- dual-run first canary set
- document mismatches

### PR 7+

- compatibility closure PRs driven by canary mismatches
- headless smoke suite rollout

## Ownership Notes

Recommended ownership split if parallelized later:

- loader and route metadata
- host/runtime kernel
- view tree and selectors
- e2e provider integration
- canary migration and dual-run calibration

This reduces merge overlap and keeps responsibilities coherent.

## Success Metrics

Track the following over time:

- median runtime for the local fast-path suite
- number of DevTools-only runtime tests remaining
- number of dual-run canaries green on both providers
- hang frequency and infra-driven flake rate
- mean time to validate a runtime regression locally

## Stop Conditions

Re-evaluate the effort if either of these becomes true:

- compatibility work is dominated by unsupported host APIs rather than page runtime semantics
- canary disagreements remain high after core lifecycle, routing, events, and observable state are implemented

If that happens, narrow the ambition further and keep the runtime focused on the subset where it is demonstrably valuable.

## Immediate Next Step

Start with Phase 0 and Phase 1 together:

- inventory current runtime tests by dependency profile
- introduce provider abstraction without changing existing DevTools behavior

That gives the project a migration seam immediately and avoids building the headless runtime in isolation from the actual e2e surface it must replace.
