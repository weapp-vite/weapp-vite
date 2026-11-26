## 3. Coding Rules

- Use TypeScript, ESM, 2-space indentation, kebab-case package names, camelCase variables/files, PascalCase classes/types, and named exports unless a file deliberately has one default owner.
- Never use Prettier in this repository. Use the applicable ESLint/Lefthook flow for code and Markdown, keep ESLint/Stylelint/TypeScript clean, and fix Stylelint issues in standalone styles and Vue `<style>` blocks. JSDoc comments must be Chinese.
- Fix the owning architecture and preserve a single source of truth. Avoid case-specific fallbacks, duplicate triggers, hidden coupling, or abstractions that exist only to make one test pass.
- Runtime markers, keys, and helper-name constants shared across packages or tests belong in `@weapp-core/constants` when they enter shipped code or require a stable cross-package contract.
- Final `dist`, mini-program, and plugin outputs must be persisted by Vite/Rolldown emit/write. Do not patch, synchronize, clean up, or restore bundle files with direct `writeFile` calls.
- If a source file exceeds 300 lines, evaluate a split and record the decision in PR notes. Prefer `foo/index.ts`, `foo/style.ts`, and `foo/helpers.ts` over dotted helper filenames.

### 3.1 Rust and Native Paths

- Treat JS ↔ Rust calls, serialization, and AST data movement as primary performance costs. Prefer one batch API that sends complete source/config/tasks, parses once, and returns structured results. Avoid per-query or per-node N-API traffic and JS callbacks from native traversal.
- Keep native AST acceleration optional and explicitly enabled. Loading, parsing, or native execution failures must fall back to the existing Babel/Oxc/Vue compiler path.
- Expand native coverage only with correctness parity tests and a real hot-path profile that shows stable net benefit after boundary costs. Preserve the JS/Oxc fallback during a POC.
