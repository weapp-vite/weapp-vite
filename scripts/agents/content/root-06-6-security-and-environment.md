## 6. Security and Environment

- Use Node.js `^22.23.4 || ^24.22.1 || >=26.12.1` with compatible pnpm for the repository and scaffolding. Vite+ templates require `^24.22.1 || >=26.12.1`. `weapp-ide-cli` open/preview/upload also requires the DevTools service port.
- Never commit secrets. Use `.env.local` or environment variables, and never expose credentials, cookies, tokens, private URLs, local identities, or machine paths in source, tests, fixtures, docs, PR text, or artifacts.
- Code that runs in a mini-program host must not depend on `eval`, `new Function`, `Function("return this")()`, string timers, or other dynamic evaluation. Resolve globals statically through explicit aliases, compile-time injection, or direct testable references.
- Before using `queueMicrotask`, Web/DOM/Node globals, or modern built-ins in host runtime code, probe existence and minimal semantics in the target real IDE AppService, base library, renderer, and platform. Browser, Node, types, and headless results do not replace that evidence. Use an explicit compatibility layer or the configured runtime-global injection.
- Mini-program runtime API ESLint rules apply only to source that enters AppService. Exclude build-time/CLI/test/Web-only/WXS code and generated output.

### 6.1 Workspace Hygiene

- Preserve `.vscode/settings.json` exclusions for generated, cache, dependency, coverage, temporary, report, and worktree directories. When adding such a directory, update the relevant file, watcher, search, Tailwind, and i18n exclusions.
- Keep `search.followSymlinks: false` unless a task explicitly needs linked content. Diagnose workspace CPU spikes by checking exclusion drift before changing language services, extensions, or product code.
