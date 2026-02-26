---
name: wevu-best-practices
description: Apply Vue-3-style runtime best practices for wevu in mini-programs. Use when implementing pages/components/stores with wevu, defining lifecycle hooks, handling setData diff behavior, designing props/emit and bindModel flows, integrating with weapp-vite SFC JSON macros, or troubleshooting compatibility differences versus Vue 3.
---

# wevu-best-practices

## Overview

Write mini-program business logic with Vue-style ergonomics while respecting wevu runtime constraints. Keep hooks, state updates, and component contracts explicit.

## Workflow

1. Set runtime conventions first

- Import runtime APIs only from `wevu`.
- Use `defineComponent` as the registration model for both pages and components.
- Keep `data` as a function when using options-style state.

2. Use correct component/page boundaries

- Define mini-program config via Script Setup JSON macros first.
- For App/Page/Component SFC, prefer `defineAppJson` / `definePageJson` / `defineComponentJson` over `<json>` blocks.
- Declare `usingComponents` through JSON config, not script-side ESM component registration.
- Keep page hooks only in page contexts.

3. Keep reactive updates predictable

- Use `ref/reactive/computed` for state and derive template data from them.
- Register lifecycle hooks synchronously inside `setup()`.
- Use explicit bindings for forms/events when semantics are complex.

4. Design events and two-way binding intentionally

- Use `ctx.emit(event, detail, options)` with mini-program event semantics.
- For reusable field bindings, prefer `bindModel`/`useBindModel` with explicit event and parser.
- Avoid assuming full Vue web `v-model` feature parity in mini-program templates.

5. Structure stores for maintainability

- Prefer Setup Store for simple domains and strong inference.
- Use `storeToRefs` when destructuring state/getters.
- Add `createStore()` only when global plugin/persistence hooks are needed.

6. Handle compatibility and testing explicitly

- Do not use DOM/browser-only APIs in runtime logic.
- For Node/Vitest tests, stub `Component`/`wx` when testing runtime bridges.
- Treat lifecycle and provide/inject differences as platform constraints, not bugs.

## Guardrails

- Avoid hook registration after `await` in `setup()`.
- Avoid direct state destructuring without `storeToRefs` for stores.
- Avoid relying on undocumented Vue web-only behavior in templates or lifecycle timing.

## Completion Checklist

- API imports come from `wevu`, not `vue` runtime in business code.
- Page/component JSON config strategy is consistent.
- Hook registration timing is synchronous and predictable.
- Store usage follows singleton + `storeToRefs` conventions.
- Template bindings match mini-program-supported semantics.

## References

- `references/component-patterns.md`
- `references/store-patterns.md`
- `references/troubleshooting-checks.md`
