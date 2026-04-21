import { TemplateName } from './enums'

function supportsWevu(templateName: TemplateName) {
  return [
    TemplateName.wevu,
    TemplateName.wevuTdesign,
  ].includes(templateName)
}

function supportsNativePages(templateName: TemplateName) {
  return !supportsWevu(templateName)
}

function supportsPlugin(templateName: TemplateName) {
  return templateName === TemplateName.plugin
}

/**
 * @description 生成新项目的 AGENTS 指引
 */
export function createAgentsGuidelines(templateName: TemplateName) {
  const lines = [
    '# AGENTS Guidelines',
    '',
    '## Local Docs First',
    '',
    '- After dependencies are installed, prefer reading local package docs under `node_modules/weapp-vite/dist/docs/` first.',
    '- Start with `node_modules/weapp-vite/dist/docs/index.md`, then read `README.md` and `mcp.md` as needed.',
    '- Prefer local package docs over stale model memory or old web pages when command behavior is unclear.',
    '',
    '## CLI Entry',
    '',
    '- This project supports both `weapp-vite` and `wv` CLI commands.',
    '- Treat `weapp-vite dev` and `wv dev` as equivalent forms.',
    '- Prefer project scripts such as `pnpm dev`, `pnpm build`, `pnpm open`, and `pnpm g` before ad-hoc shell commands.',
    '- Use `weapp-vite prepare` or `wv prepare` when managed support files under `.weapp-vite/` need to be refreshed.',
    '- Prefer `weapp-vite screenshot` or `wv screenshot` for mini-program screenshot acceptance.',
    '- Prefer `weapp-vite compare` or `wv compare` for mini-program screenshot diff, baseline comparison, and visual regression checks.',
    '- Prefer `weapp-vite ide logs --open` or `wv ide logs --open` for DevTools terminal log bridging.',
    '- Do not default to generic browser screenshot tools when the target is the mini-program runtime in WeChat DevTools.',
    '',
    '## AI Intent Routing',
    '',
    '- When the request mentions screenshot, 截图, 页面快照, runtime screenshot, or capture the current mini-program page, default to `weapp-vite screenshot` / `wv screenshot`.',
    '- When the request mentions screenshot compare, 截图对比, diff, baseline, visual regression, 像素对比, or acceptance comparison, default to `weapp-vite compare` / `wv compare`.',
    '- Treat these commands as the primary screenshot contract for AI workflows in this project.',
    '- Only fall back to generic browser screenshot tools when the target is explicitly the web runtime instead of WeChat DevTools.',
    '',
    '## Weapp-vite Workflow',
    '',
    '- Keep `vite.config.ts` as the source of truth for `weapp` config, output behavior, and IDE/MCP automation.',
    '- Confirm `weapp.srcRoot`, routes, subpackages, and auto-import strategy before broad refactors.',
    '- Prefer minimal scoped verification: targeted `pnpm build`, targeted tests, then broader checks only when required.',
    '- If editing package source in a monorepo dependency, rebuild the touched package before validating downstream apps to avoid stale `dist`.',
    '- Keep CLI ownership explicit: native `weapp-vite` commands first, IDE passthrough second.',
    '',
    '## WeChat DevTools',
    '',
    '- Before using screenshot, preview, upload, automator, or `--open`, ensure WeChat DevTools is logged in and the service port is enabled.',
    '- Prefer writing screenshots to workspace paths such as `.tmp/acceptance.png`.',
    '',
    '## AI Skills',
    '',
    '- Recommend installing shared skills with `npx skills add sonofmagic/skills`.',
    '- In Codex/Claude environments, prefer these skills first when available:',
    '  - `$weapp-vite-best-practices` for config, build, subpackage, route, DevTools CLI orchestration, and screenshot/compare command work.',
    '  - `$weapp-vite-vue-sfc-best-practices` for `.vue` SFC macros, JSON blocks, and template compatibility.',
    '  - `$release-and-changeset-best-practices` for issue delivery, changesets, release decisions, and PR workflow.',
    '  - `$docs-and-website-sync` when documentation or AI guidance must be refreshed together with code changes.',
  ]

  if (supportsWevu(templateName)) {
    lines.push(
      '  - `$wevu-best-practices` for `wevu` runtime lifecycle, state, store, and event contracts.',
      '',
      '## Wevu Authoring',
      '',
      '- Import runtime APIs from `wevu` in business code.',
      '- Register lifecycle hooks synchronously in `setup()` and avoid hook registration after `await`.',
      '- Prefer `ref`, `reactive`, `computed`, and explicit event contracts over large opaque state writes.',
      '- Use `storeToRefs` when destructuring store state/getters.',
      '- Treat mini-program runtime constraints as primary; do not assume Vue web-only behavior.',
    )
  }

  if (supportsNativePages(templateName)) {
    lines.push(
      '  - `$native-to-weapp-vite-wevu-migration` when migrating native mini-program pages/components toward Vue SFC or wevu.',
      '',
      '## Native Mini-program Authoring',
      '',
      '- Keep native page/component structure consistent with the template unless there is a clear migration goal.',
      '- Prefer `weapp-vite generate` or `wv generate` for new app/page/component scaffolds.',
      '- If migrating this project toward Vue SFC or `wevu`, keep the migration explicit and prefer the official weapp-vite / wevu guidance first.',
    )
  }

  if (supportsPlugin(templateName)) {
    lines.push(
      '',
      '## Plugin Authoring',
      '',
      '- Keep `miniprogram/` as the host app source and `plugin/` as the plugin source root declared by `weapp.pluginRoot`.',
      '- Validate both `dist/` and `dist-plugin/` outputs after structural changes to host pages, plugin pages, or plugin public components.',
      '- If you change plugin AppID or switch away from local `dev` linkage, update both `project.config.json.appid` and `miniprogram/app.json` -> `plugins.*.provider` together.',
      '- Treat shared modules under `shared/` as regular source code that can be imported by both host and plugin entries.',
    )
  }

  return `${lines.join('\n')}\n`
}
