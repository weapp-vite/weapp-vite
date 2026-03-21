---
name: wevu-best-practices
description: 面向小程序中 wevu 运行时的实践手册：覆盖生命周期注册、响应式更新、事件契约、`bindModel/useBindModel`、`setPageLayout/usePageLayout`、根入口的 `useNativeRouter/useNativePageRouter`，以及 `wevu/router` 的 `createRouter/useRouter/useRoute` 和带有小程序兼容约束的 store 使用模式。适用于实现或重构 wevu pages/components/stores、排查 hook 时序、router 使用方式或 setData diff 行为，或解释它与 Vue 3 Web runtime 差异的场景。
---

# wevu-best-practices

## 目的

Implement mini-program runtime logic with Vue-style ergonomics while respecting wevu constraints. Keep lifecycle timing, reactive updates, and component contracts explicit.

## 触发信号

- User asks how to implement page/component logic with `wevu`.
- User asks about lifecycle hook timing or setup patterns.
- User asks about props/emit contracts, event detail payloads, or two-way binding patterns.
- User asks about store architecture, `storeToRefs`, or type inference behavior.
- User reports runtime differences versus Vue 3 web behavior.

## 适用边界

Use this skill when the main problem is runtime behavior and state/event contracts.

Do not use this as the primary skill when:

- The task is build/config/subpackage/CI orchestration. Use `weapp-vite-best-practices`.
- The task is mainly `.vue` macro/template syntax compatibility. Use `weapp-vite-vue-sfc-best-practices`.
- The task is native mini-program phased migration. Use `native-to-weapp-vite-wevu-migration`.

## 快速开始

1. Verify runtime API imports and component registration model.
2. Confirm hook registration timing and component/page boundaries.
3. Normalize state/event binding patterns (`ref/reactive`, `emit`, `bindModel`).
4. Validate with targeted runtime or unit tests.

## 执行流程

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

## 约束

- Avoid hook registration after `await` in `setup()`.
- Avoid direct state destructuring without `storeToRefs` for stores.
- Avoid relying on undocumented Vue web-only behavior in templates or lifecycle timing.
- Avoid returning non-serializable native instance objects into template state.

## 输出要求

When applying this skill, return:

- A runtime risk summary (lifecycle/state/event/store).
- Concrete file-level edits.
- Compatibility caveats versus Vue 3 web runtime.
- Minimal verification commands and expected signals.

## 完成检查

- API imports come from `wevu`, not `vue` runtime in business code.
- Page/component boundary usage is consistent.
- Hook registration timing is synchronous and predictable.
- Store usage follows singleton + `storeToRefs` conventions.
- Template/event bindings match mini-program-supported semantics.

## 参考资料

- `references/component-patterns.md`
- `references/store-patterns.md`
- `references/troubleshooting-checks.md`
