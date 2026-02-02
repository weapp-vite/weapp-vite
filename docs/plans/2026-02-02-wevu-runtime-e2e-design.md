# Wevu Runtime E2E Design

Date: 2026-02-02

## Goals

- Add a dedicated E2E app to cover all _runtime_ wevu public APIs that are directly usable at runtime.
- Use WeChat automator for runtime assertions + WXML snapshots; use build-only + markup/style snapshots for Alipay/TT.
- Cover both page and component registration flows (defineComponent, component usage, emit/provide/inject).
- Include store behaviors (plugins, subscribe/onAction, patch/reset, cross-page sharing, HMR on weapp).
- Avoid SFC; use TS + WXML/WXSS only.

## Non-goals

- Type-only macros (defineProps/defineEmits/defineModel/etc) are excluded from E2E coverage.
- No real-device automation for Alipay/TT in this phase.

## Platforms

- WeChat (weapp): build + automator run + WXML snapshot.
- Alipay (alipay): build + AXML/ACSS snapshot + output existence checks.
- ByteDance (tt): build + TTML/TTSS snapshot + output existence checks.

## E2E App Structure

New app: `e2e-apps/wevu-runtime-e2e`

```
e2e-apps/wevu-runtime-e2e/
  src/
    app.json
    app.ts
    pages/
      reactivity/
      runtime/
      store/
      diff/
      hmr/
    components/
      x-child/
      x-model/
    shared/
      e2e.ts
      store.ts
```

Each page exports a `runE2E()` method used by automator, and writes a stable summary to `data.__e2e` for WXML snapshotting.

## Coverage Matrix

### Reactivity page

- `ref`, `reactive`, `shallowReactive`, `readonly`, `computed`
- `watch`, `watchEffect`, `effect`, `stop`
- `batch`, `startBatch`, `endBatch`
- `effectScope`, `onScopeDispose`, `getCurrentScope`
- `isRef`, `unref`, `toRef`, `toRefs`, `toValue`, `shallowRef`, `triggerRef`
- `isReactive`, `isRaw`, `markRaw`, `toRaw`, `getReactiveVersion`, `traverse`

Assertions focus on update ordering, batching, deep/shallow behavior, scope cleanup, and ref unwrapping.

### Runtime page

- `defineComponent` in page context
- `setup` hooks: `onLoad/onShow/onReady/onHide/onUnload/onPageScroll/onShareAppMessage/...`
- Vue-compat hooks: `onMounted/onUpdated/onBeforeUpdate/onBeforeMount/onBeforeUnmount/onUnmounted/onActivated/onDeactivated/onErrorCaptured`
- `provide/inject`, `getCurrentInstance`, `getCurrentSetupContext`
- `emit` (via component), `bindModel/useBindModel` (via component)

Hooks that are hard to trigger in automation are registered and executed via internal simulation: handlers are collected during setup and invoked in `runE2E()` to verify registration and execution.

### Store page

- `createStore`, `defineStore`, `storeToRefs`
- Plugins
- `$subscribe`, `$onAction`
- `$patch` (object and function), `$reset`
- Cross-page sharing: second page reads the same store instance and validates state persistence

### Diff page

- `markNoSetData` and diff behavior
- `setData` interception: temporarily wrap `this.setData` to capture payloads
- Snapshot diff size and path granularity (object vs array vs null/undefined)

### HMR page (weapp only)

- Run under `weapp-vite dev`
- Simulate hot replacement by re-registering store module and verifying state retention and new action handler
- Requires WeChat DevTools server port enabled

## Components

- `x-child`: props, computed, watch, methods, emit, provide/inject
- `x-model`: bindModel/useBindModel bridge with a value/change pattern

## E2E Tests

1. `e2e/wevu-runtime.weapp.test.ts`
   - Build weapp
   - Automator: `reLaunch` each page, call `runE2E()`, assert structure
   - Snapshot WXML per page

2. `e2e/wevu-runtime.platforms.test.ts`
   - Build `alipay` and `tt`
   - Assert key outputs exist
   - Snapshot AXML/ACSS and TTML/TTSS

3. `e2e/wevu-runtime.hmr.test.ts`
   - Start `weapp-vite dev` (weapp only)
   - Automator drives `pages/hmr`
   - Verify HMR-specific state/action behavior

Shared helpers live in `e2e/wevu-runtime.utils.ts` for building, loading pages, and reading outputs per platform.

## Risks and Mitigations

- Flaky lifecycle hooks: keep hook results deterministic; avoid time-based assertions.
- HMR environment availability: produce a clear error if devtools port is not enabled.
- Snapshot noise: normalize timestamps/ids and keep WXML output stable via `__e2e` data.
