---
name: weapp-acceptance
description: Verify changes in weapp-vite native, Wevu, or React mini-program projects with native Vitest APIs, the weapp-vite headless simulator, and provider-compatible DevTools E2E. Use after implementing a mini-program feature or investigating a runtime regression.
---

# Weapp verification

Keep planning, code edits, assertions, and test execution in the host agent. Use the project's existing Vitest entry and the public weapp-vite testing namespaces.

1. Read the project's `AGENTS.md`, package scripts, and existing tests. Preserve the project's package manager, test configuration, and current test organization.
2. For page or component behavior, use `test`, `it`, `expect`, and hooks directly from `vitest`. Build the actual mini-program artifact with `buildTestArtifact()` and create an isolated simulator project with `createTestProject({ artifact })`, both from `weapp-vite/test`. Close each project in `finally` or a native Vitest teardown hook.
3. Run the focused test first, then the project's normal Vitest command. Add a regression assertion for the requested behavior instead of inferring expected values from the current output.
4. Use `launchAutomator()` from `weapp-vite/e2e` or the repository's provider-compatible `e2e/ide/**` suites when the change depends on WeChat DevTools runtime behavior. Run the headless provider and DevTools provider for touched shared scenarios, following `$weapp-devtools-e2e-best-practices` for automator reuse, environment checks, and cleanup.
5. Report headless and DevTools results separately. A headless simulator result does not establish that the official DevTools runtime passed, and an unavailable DevTools environment remains unverified.

Do not create `weapp-acceptance.config.json` or `acceptance/*.json` for new project tests. Use the legacy `wv accept` flow only when the user explicitly asks to run or maintain that existing workflow.
