# Scoped Slots Rebuild (Weapp-Vite + Wevu)

## Overview

Rebuild scoped slots support for Vue 3 templates in weapp-vite by combining a compiler-side generic slot component output with a runtime owner snapshot store in wevu. Ordinary (non-scoped) slots continue to use native mini-program slots.

## Goals

- Support Vue 3 `v-slot` syntax (identifier, destructuring, dynamic slot names).
- Provide scoped slot data across component boundaries on all supported mini-program platforms.
- Keep user-facing API minimal (no manual runtime wiring).

## Non-goals

- Preserve legacy `scopedSlots` template options (`legacy/dynamic/compat`).
- Implement a full render-function pipeline.

## Compiler Design (weapp-vite)

- Detect `v-slot` on consumer side and materialize a dedicated scoped slot component file per slot usage.
- Parent component output:
  - Add `generic:scoped-slots-<slotKey>="<componentName>"`.
  - Add `vue-slots="{{[...]}}"` for slot tracking.
  - Emit `__wv-slot-owner-id="{{__wvOwnerId}}"`.
  - When inside `v-for`, emit `__wv-slot-scope` with loop locals.
- Provider `<slot>` output:
  - Keep native `<slot>` for non-scoped usage.
  - For scoped slots, append `<scoped-slots-<slotKey> ... />` with slot props + owner id.
- Slot key rules:
  - Static slot name uses its literal (`default`, `header`, etc.).
  - Dynamic slot names map to a generated key (`dyn0`, `dyn1`, …) for generic binding.
- AST rewrite for scoped slots:
  - Free variables in slot content rewrite to `__wvOwner.<name>`.
  - Slot props rewrite to `__wvSlotProps` access.
  - Warn on unsupported patterns (e.g. direct `slotProps` object usage if rewrite cannot guarantee behavior).
- Compatibility subset:
  - Remove `default` slot name on output.
  - Convert slot root `block` to `view` where needed.

## Runtime Design (wevu)

- Add `ownerStore` singleton:
  - `ownerId -> snapshot` and subscriber list.
- Each component instance gets a stable `__wvOwnerId` injected into data.
- On updates, refresh `ownerStore` with the latest `runtime.snapshot()`.
- Slot components subscribe via `__wv-owner-id` and sync `__wvOwner` via `setData`.
- Slot props passed as `__wv-slot-props` and assigned to `__wvSlotProps`.
  - Slot scope locals passed via `__wv-slot-scope` and merged into `__wvSlotProps`.

## Configuration

- Introduce `scopedSlotsCompiler: 'auto' | 'augmented'` and `slotMultipleInstance: boolean`.
- Default: `scopedSlotsCompiler='auto'`, `slotMultipleInstance=true`.

## Outputs

- Generate extra assets for each scoped slot:
  - `<componentName>.wxml`, `<componentName>.js`, `<componentName>.json`, optional `<componentName>.wxss`.
- Ensure `usingComponents` includes scoped slot components and that `generic` bindings are wired.

## Testing

- Extend template compiler tests for scoped slot output and dynamic slot names.
- Add wevu runtime tests for owner snapshot propagation and slot component subscription.
