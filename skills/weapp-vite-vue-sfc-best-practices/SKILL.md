---
name: weapp-vite-vue-sfc-best-practices
description: Vue SFC implementation playbook for weapp-vite mini-program projects, including `<script setup lang="ts">`, JSON macros (`defineAppJson/definePageJson/defineComponentJson`), `usingComponents`, template directive compatibility, and SFC compile/runtime troubleshooting. Use when users ask about `.vue` authoring or refactoring in mini-programs (e.g. "v-model 在小程序里怎么写", "definePageJson 和 <json> 怎么选", "SFC 编译报错", "usingComponents 不生效").
---

# weapp-vite-vue-sfc-best-practices

## Purpose

Implement Vue SFC for mini-programs with a two-layer model: compile-time rules (weapp-vite) and runtime behavior (wevu). Favor predictable compile output and explicit mini-program semantics.

## Trigger Signals

- User asks how to write/refactor mini-program `.vue` files.
- User asks about JSON macro usage (`definePageJson`, `defineComponentJson`, `defineAppJson`) or `<json>` migration.
- User hits directive compatibility issues (`v-model` assignment rules, `v-bind="object"` behavior).
- User reports SFC compile or runtime mismatch after template/script changes.
- User asks how to declare `usingComponents` correctly in SFC.

## Scope Boundary

Use this skill when the center of gravity is SFC authoring and compile compatibility.

Do not use this as the primary skill when:

- The issue is mostly project-level build/CI/subpackage strategy. Use `weapp-vite-best-practices`.
- The issue is mostly runtime lifecycle/store/event architecture. Use `wevu-best-practices`.
- The task is phased migration from native mini-program. Use `native-to-weapp-vite-wevu-migration`.

## Quick Start

1. Confirm SFC type first: App, Page, or Component.
2. Pick one JSON macro family that matches the SFC role.
3. Validate template directives against mini-program compatibility constraints.
4. Verify runtime API imports and hook timing.

## Execution Protocol

1. Classify the failure stage

- Compile-time: macro syntax, template transform, `usingComponents` declaration.
- Runtime: hook timing, event payload, reactive update expectations.
- Tooling/type: Volar config, `vueCompilerOptions.lib`, type resolution.

2. Enforce SFC boundaries

- Keep `<template>/<script>/<style>` responsibilities explicit.
- Manage mini-program JSON via Script Setup JSON macros first.
- Use `<json>` only for legacy compatibility or explicit migration constraints.
- Do not register mini-program components via script-side ESM registration patterns.

3. Apply script rules

- Prefer `<script setup lang="ts">`.
- Import runtime APIs from `wevu` in business logic.
- Register hooks synchronously in `setup()` and avoid post-`await` registration.

4. Apply macro and template rules

- Use only one macro family per SFC.
- App -> `defineAppJson`; Page -> `definePageJson`; Component -> `defineComponentJson`.
- Keep macro calls top-level with a single object argument.
- For `v-model`, only use assignable left values: `x`, `x.y`, `x[i]`.
- Avoid unsupported forms such as `v-model` modifiers/arguments and full-object `v-bind` expansion assumptions.

5. Verify narrowly

- Run targeted checks that match the touched SFC files.
- Escalate to broader runs only when cross-page behavior is affected.

## Guardrails

- Do not treat mini-program component registration like web Vue component registration.
- Do not register hooks after `await` in `setup()`.
- Do not assume web Vue template features are fully available in mini-program compilation.
- Do not mix multiple JSON macro families in one SFC.
- Do not mix SFC syntax fixes with unrelated runtime architecture refactors.

## Output Contract

When applying this skill, return:

- Stage-based diagnosis (compile/runtime/tooling).
- Concrete SFC-level edit list.
- Compatibility notes for directives/macros used.
- Minimal verification commands.

## Completion Checklist

- SFC config path is clear and macro-first (avoid new `<json>` usage by default).
- `usingComponents` strategy is deterministic and path-safe.
- Template usage avoids unsupported directive forms.
- Runtime API imports come from `wevu`.
- Hook timing and page/component context are valid.

## References

- `references/macro-config-checklist.md`
- `references/template-compat-matrix.md`
- `references/troubleshooting-playbook.md`
