---
name: weapp-ide-cli-best-practices
description: "Command governance and automation playbook for weapp-ide-cli, including official CLI passthrough, automator commands, config/i18n persistence, command catalog export, and integration contracts with weapp-vite CLI dispatch."
---

# weapp-ide-cli-best-practices

## Purpose

Design and evolve `weapp-ide-cli` with deterministic command behavior, automation-friendly UX, and stable integration contracts for other CLIs (especially `weapp-vite`).

## Trigger Signals

- User asks to add/refactor `weapp-ide-cli` commands or argument validation.
- User asks to expose command metadata for external CLI dispatch.
- User asks to improve DevTools automation, screenshot, or automator subcommands.
- User asks to add language switching or config persistence behavior.
- User asks how `weapp-vite` should delegate to `weapp-ide-cli`.

## Scope Boundary

Use this skill when the center of gravity is command routing, CLI UX, config persistence, and cross-package CLI contracts.

Do not use this as the primary skill when:

- The issue is mainly `weapp-vite` project build/subpackage architecture. Use `weapp-vite-best-practices`.
- The issue is mainly Vue SFC syntax/macro compatibility. Use `weapp-vite-vue-sfc-best-practices`.
- The issue is runtime lifecycle/state architecture in components/pages. Use `wevu-best-practices`.

## Quick Start

1. Classify change type: command addition, validation, i18n/config, or dispatch contract.
2. Update command source-of-truth first, then update parser/dispatcher.
3. Add/adjust tests around routing and error behavior.
4. Sync docs in package README and website package page.

## Execution Protocol

1. Keep command taxonomy explicit

- Maintain command groups as separate layers:
  - WeChat official passthrough commands
  - automator enhanced commands
  - config commands
  - minidev namespace passthrough
- Export top-level command catalog from `weapp-ide-cli` for external reuse.
- Provide a direct predicate function to check command support.

2. Enforce dispatch invariants

- Parse global language option before command routing.
- Route minidev namespace and automator commands before generic WeChat CLI passthrough.
- Keep `help <automator-command>` behavior explicit and deterministic.
- Validate critical arguments before invoking external CLI.

3. Keep i18n + config predictable

- Default language is Chinese.
- Support command-level temporary language override and persistent config language.
- Persist config to user directory config file and expose `config` subcommands for read/write/export/import.
- Prefer Chinese user-facing messages, with switchable English fallback.

4. Establish integration contract for upstream CLI

- Upstream CLI (e.g. `weapp-vite`) should:
  - execute its native command table first
  - delegate only when `isWeappIdeTopLevelCommand(command)` is true
  - avoid blind passthrough for unknown commands
- Keep this rule documented and tested on both sides.

5. Verify narrowly

- Prefer targeted tests in:
  - `packages/weapp-ide-cli/test/*.test.ts`
  - related `packages/weapp-vite/src/cli/*.test.ts` when dispatch contract changes
- Run lint on touched docs and source files only.

## Guardrails

- Do not duplicate command lists in multiple packages as independent sources of truth.
- Do not add user-facing text without i18n wrapping.
- Do not couple command parsing with business side effects before validation.
- Do not let unknown commands silently passthrough when integrating with another CLI.

## Output Contract

When applying this skill, return:

- Command-level design summary (what changed and why).
- Concrete file edits for catalog/routing/validation/docs/tests.
- Verification commands and expected outcomes.
- Cross-package contract notes when `weapp-vite` integration is touched.

## Completion Checklist

- Top-level command catalog and predicate are exported from `weapp-ide-cli`.
- Dispatch priority is deterministic and covered by tests.
- New/changed user-facing messages support Chinese default and English switch.
- Config persistence and command behavior are documented.
- If integration changed, `weapp-vite` uses exported catalog instead of duplicated lists.

## References

- `references/command-catalog-and-dispatch.md`
- `references/i18n-config-playbook.md`
