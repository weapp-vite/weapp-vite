## 7. Project Skills (Codex + Claude Code)

- Skill source lives in `skills/*`. This index includes consumer, optional and contributor workflows, not a default installation list:
  - `weapp-vite-best-practices`
  - `weapp-acceptance`
  - `docs-and-website-sync`
  - `release-and-changeset-best-practices`
  - `weapp-devtools-e2e-best-practices`
  - `weapp-vite-vue-sfc-best-practices`
  - `weapp-vite-react-best-practices`
  - `wevu-best-practices`
  - `native-to-weapp-vite-wevu-migration`
- `skills/distribution.json` selects four consumer skills for `weapp-vite`, `wevu` and `@weapp-vite/react`, published at `skills/<name>/SKILL.md`.

### Consumer projects

- Manual installation for a native project: `npx skills add sonofmagic/skills --skill weapp-vite-best-practices`. This works with npm, Yarn and older pnpm. Select SFC + Wevu or React skills for those stacks; migration is optional.
- Optional dependency installation (pnpm >=12.11.0): merge `skills: { dirs: [".agents/skills"] }` into `pnpm-workspace.yaml`, preserving team settings; run `pnpm install`, then interactive `pnpm approve`. Keep approval manual and let pnpm manage its links. Full commands, version differences and manual-entry safety: [AI Skills guide](https://vite.weapp.dev/guide/skills).

### Repository contributors

- This repo may also include project-specific Claude skills under `.claude/skills/*` (for example `playwright-cli`).
- `pnpm skills:link` will sync both `skills/*` and `.claude/skills/*` into local Codex/Claude skill directories.
- Internal maintainer skills are under `maintainers/skills/*`; do not expose them in user guidance.
- For local development and direct use of this checkout's skills in Codex and Claude Code (no global package install), run:
  - `pnpm skills:link`
- If you only need to preview linking behavior without changing local env, run:
  - `pnpm skills:link:dry`
