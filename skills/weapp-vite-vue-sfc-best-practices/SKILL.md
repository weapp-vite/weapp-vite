---
name: weapp-vite-vue-sfc-best-practices
description: Apply detailed usage patterns and best practices for Vue SFC in weapp-vite projects. Use when writing or refactoring `.vue` files for mini-programs, choosing `<script setup>` and JSON macro strategy, defining `usingComponents`, handling template directive compatibility (`v-model` / `v-bind` limits), coordinating wevu runtime hooks, or troubleshooting SFC compile/runtime issues.
---

# weapp-vite-vue-sfc-best-practices

## Overview

Implement Vue SFC in mini-programs with a two-layer mindset: compile-time rules (weapp-vite) and runtime behavior (wevu). Keep SFC structure explicit, avoid web-only assumptions, and optimize for predictable output.

## Workflow

1. Establish SFC boundaries

- Treat `<template>/<script>/<style>` as separate responsibilities, with config managed by JSON macros first.
- Keep mini-program config in Script Setup JSON macros. Use `<json>` only for legacy compatibility.
- Avoid script-side ESM component registration for mini-program components.

2. Choose script strategy

- Prefer `<script setup lang="ts">` for page/component logic.
- Import runtime APIs from `wevu` (not `vue`) in business logic.
- Keep hook registration synchronous in `setup()`.

3. Configure JSON correctly

- Use one macro family per SFC: `definePageJson` or `defineComponentJson` or `defineAppJson`.
- For App/Page/Component SFC, prefer the corresponding macro even for static config.
- App uses `defineAppJson`, Page uses `definePageJson`, Component uses `defineComponentJson`.
- Keep macro calls top-level and single-argument.
- Remember macro output has highest merge priority over `<json>` and auto-inferred config.

4. Author templates with compatibility constraints

- Use mini-program component/event semantics.
- For `v-model`, only use assignable left values (`x`, `x.y`, `x[i]`).
- Avoid relying on unsupported patterns (`v-model` modifiers/arguments, `v-bind="object"` expansion).

5. Coordinate with wevu runtime

- Use `defineComponent` model for page/component registration.
- Use explicit value/event bindings or `bindModel` for complex form components.
- Keep page event hooks aligned with page context and trigger conditions.

6. Troubleshoot by stage

- Compile-time issues: check macro usage, `usingComponents`, template syntax limits.
- Runtime issues: check API import source, hook timing, setData/diff expectations.
- IDE/type issues: check Volar plugin and `vueCompilerOptions.lib` alignment.

## Guardrails

- Do not treat mini-program component registration like web Vue component registration.
- Do not register hooks after `await` in `setup()`.
- Do not assume web Vue template features are fully available in mini-program compilation.
- Do not mix multiple JSON macro families in one SFC.

## Completion Checklist

- SFC config path is clear (prefer one JSON macro family; avoid new `<json>` usage).
- `usingComponents` strategy is deterministic and path-safe.
- Template usage avoids unsupported directive forms.
- Runtime API imports come from `wevu`.
- Hook timing and page/component context are valid.

## References

- `references/macro-config-checklist.md`
- `references/template-compat-matrix.md`
- `references/troubleshooting-playbook.md`
