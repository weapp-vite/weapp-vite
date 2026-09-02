## 7. Project Skills (Codex + Claude Code)

- This repo ships user-facing skills under `skills/*`:
  - `weapp-vite-best-practices`
  - `docs-and-website-sync`
  - `release-and-changeset-best-practices`
  - `weapp-devtools-e2e-best-practices`
  - `weapp-vite-vue-sfc-best-practices`
  - `weapp-vite-react-best-practices`
  - `wevu-best-practices`
  - `native-to-weapp-vite-wevu-migration`
- Recommended remote install source for all public skills is `sonofmagic/skills`:
  - `npx skills add sonofmagic/skills`
- This repo may also include project-specific Claude skills under `.claude/skills/*` (for example `playwright-cli`).
- `pnpm skills:link` will sync both `skills/*` and `.claude/skills/*` into local Codex/Claude skill directories.
- Internal maintainer skills are under `maintainers/skills/*`; do not expose them in user guidance.
- For local development and direct use of this repository's latest skills in both Codex and Claude Code, run:
  - `pnpm skills:link`
- If you only need to preview linking behavior without changing local env, run:
  - `pnpm skills:link:dry`
