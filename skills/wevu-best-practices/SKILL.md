---
name: wevu-best-practices
description: "Runtime playbook for wevu in mini-programs: lifecycle registration, reactive state updates, event contracts, bindModel/useBindModel, and Pinia/store usage patterns with mini-program compatibility constraints. Use when users implement or refactor wevu pages/components/stores, debug hook timing or setData-diff behavior, or ask about differences from Vue 3 web runtime."
---

# wevu-best-practices

## Purpose

Implement mini-program runtime logic with Vue-style ergonomics while respecting wevu constraints. Keep lifecycle timing, reactive updates, and component contracts explicit.

## Trigger Signals

- User asks how to implement page/component logic with `wevu`.
- User asks about lifecycle hook timing or setup patterns.
- User asks about props/emit contracts, event detail payloads, or two-way binding patterns.
- User asks about store architecture, `storeToRefs`, or type inference behavior.
- User reports runtime differences versus Vue 3 web behavior.

## Scope Boundary

Use this skill when the main problem is runtime behavior and state/event contracts.

Do not use this as the primary skill when:

- The task is build/config/subpackage/CI orchestration. Use `weapp-vite-best-practices`.
- The task is mainly `.vue` macro/template syntax compatibility. Use `weapp-vite-vue-sfc-best-practices`.
- The task is native mini-program phased migration. Use `native-to-weapp-vite-wevu-migration`.

## Quick Start

1. Verify runtime API imports and component registration model.
2. Confirm hook registration timing and component/page boundaries.
3. Normalize state/event binding patterns (`ref/reactive`, `emit`, `bindModel`).
4. Validate with targeted runtime or unit tests.

## Execution Protocol

1. Establish runtime conventions

- Import runtime APIs from `wevu` only.
- Use `defineComponent` registration for both pages and components.
- Keep options-style `data` as a function when used.

2. Validate boundaries and timing

- Keep page hooks in page context only.
- Register lifecycle hooks synchronously in `setup()`.
- Avoid post-`await` hook registration.

3. Normalize reactive update patterns

- Prefer `ref/reactive/computed` for state derivation.
- Avoid large opaque state writes; prefer fine-grained reactive updates.
- Use explicit bindings when form/event semantics are non-trivial.

4. Define event and two-way binding contracts

- Use `ctx.emit(event, detail, options)` with mini-program semantics.
- Prefer `bindModel`/`useBindModel` for reusable field contracts.
- Document parser/formatter behavior when value transforms are involved.

5. Apply store discipline

- Prefer Setup Store for simple domains and strong TS inference.
- Use `storeToRefs` when destructuring state/getters.
- Introduce `createStore()` only when global plugin/persistence behavior is required.

6. Verify compatibility explicitly

- Avoid DOM/browser-only APIs in runtime business logic.
- In Node/Vitest, stub `Component`/`wx` for bridge tests.
- Treat platform differences as explicit constraints, not implicit bugs.

## Guardrails

- Avoid hook registration after `await` in `setup()`.
- Avoid direct state destructuring without `storeToRefs` for stores.
- Avoid relying on undocumented Vue web-only behavior in templates or lifecycle timing.
- Avoid returning non-serializable native instance objects into template state.

## Output Contract

When applying this skill, return:

- A runtime risk summary (lifecycle/state/event/store).
- Concrete file-level edits.
- Compatibility caveats versus Vue 3 web runtime.
- Minimal verification commands and expected signals.

## Completion Checklist

- API imports come from `wevu`, not `vue` runtime in business code.
- Page/component boundary usage is consistent.
- Hook registration timing is synchronous and predictable.
- Store usage follows singleton + `storeToRefs` conventions.
- Template/event bindings match mini-program-supported semantics.

## References

- `references/component-patterns.md`
- `references/store-patterns.md`
- `references/troubleshooting-checks.md`
