## 7. Project Skills (Codex + Claude Code)

- Repository-owned skill sources live in `skills/*`. This index includes contributor workflows, not a default installation list:
  - `weapp-acceptance`
  - `docs-and-website-sync`
  - `release-and-changeset-best-practices`
  - `weapp-devtools-e2e-best-practices`
  - `native-to-weapp-vite-wevu-migration`
- Package-owned consumer skills are committed directly in their owner package and published from the same `skills/<name>/` tree:
  - `packages/weapp-vite/skills/`: `weapp-vite-best-practices`, `weapp-vite-vue-sfc-best-practices`
  - `packages-runtime/wevu/skills/`: `wevu-best-practices`
  - `packages-runtime/react/skills/`: `weapp-vite-react-best-practices`
  - `packages-runtime/json-render/skills/`: `wevu-json-render-best-practices`
  - `packages-runtime/a2ui/skills/`: `wevu-a2ui-best-practices`
- `skills/scripts/package-skills.mjs` discovers workspace package sources and root contributor sources. There is no root distribution registry, build-time copy, prepack generation, or generated package skill directory.

### Consumer projects

- Manual installation for a native project: `npx skills add sonofmagic/skills --skill weapp-vite-best-practices`. This works with npm, Yarn and older pnpm. Select SFC + Wevu or React skills for those stacks; migration is optional.
- Optional dependency installation (pnpm >=12.11.0): merge `skills: { dirs: [".agents/skills"] }` into `pnpm-workspace.yaml`, preserving team settings; run `pnpm install`, then interactive `pnpm approve`. Keep approval manual and let pnpm manage its links. Full commands, version differences and manual-entry safety: [AI Skills guide](https://vite.weapp.dev/guide/skills).

### Repository contributors

- This repo may also include project-specific Claude skills under `.claude/skills/*` (for example `playwright-cli`).
- `pnpm skills:link` will sync repository-owned `skills/*`, package-local consumer skills, and `.claude/skills/*` into local Codex/Claude skill directories.
- Internal maintainer skills are under `maintainers/skills/*`; do not expose them in user guidance.
- For local development and direct use of this checkout's skills in Codex and Claude Code (no global package install), run:
  - `pnpm skills:link`
- If you only need to preview linking behavior without changing local env, run:
  - `pnpm skills:link:dry`
