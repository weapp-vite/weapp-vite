# Wevu setup lifecycle switch

## Context

Wevu currently mounts runtime and runs `setup()` during component `created`, then defers `setData` until `attached`. This means `setup()` sees default props rather than values passed from the parent. To align closer with Vue 3 behavior, we need a switch that allows running `setup()` in `attached` instead, while still supporting the legacy `created` behavior.

## Goals

- Allow `setup()` to run in either `created` or `attached`.
- Default to `attached` to match Vue 3 expectations for props availability.
- Support configuration at three levels: component option, wevu global defaults, and weapp-vite compiler/plugin defaults.
- Preserve existing `setData` deferral semantics when running in `created`.

## Non-goals

- Changing page `onLoad` behavior or non-component lifecycles.
- Altering the reactivity model or `props` normalization.

## Proposal

- Add a new component option: `setupLifecycle: 'created' | 'attached'`.
- Default behavior is `attached` when the option is missing or invalid.
- Precedence: component option > wevu defaults (`setWevuDefaults`) > compiler-injected defaults > implicit default.

## Runtime behavior

- In `registerComponent`, read and remove `setupLifecycle` from `restOptions` before calling `Component()`.
- If `setupLifecycle === 'created'`:
  - `lifetimes.created` mounts runtime with `deferSetData: true` and syncs props.
  - `lifetimes.attached` only enables deferred `setData` and syncs props (existing behavior).
- If `setupLifecycle !== 'created'` (default `attached`):
  - `lifetimes.created` only handles template refs and user hooks.
  - `lifetimes.attached` mounts runtime and syncs props immediately; `enableDeferredSetData` is a no-op.
- Props observers remain unchanged; `__wevuProps` is initialized from `instance.properties` at mount time.

## Compiler/plugin integration

- `weapp-vite` already injects `wevu.defaults` into compiled SFC output. After adding the new option to wevu types, `wevu.defaults.component.setupLifecycle` will flow through the existing defaults injection path.
- No new plugin hooks are required; it is a default value in `wevu.defaults`.

## Edge cases

- Invalid values should silently fall back to `attached`.
- If observers run before `attached`, they no-op until `__wevuProps` exists, but the initial mount uses current `properties` so props are correct.

## Testing

- Update runtime component tests to expect default `attached` behavior.
- Add a new test asserting `setupLifecycle: 'created'` preserves deferred `setData` behavior.
