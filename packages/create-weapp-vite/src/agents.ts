import type { TemplateName } from './enums'
import type { Toolchain } from './toolchain'
import { generatedAgentGuidelines } from './generated/agents'

// Public skill names remain explicit here so the repository contract checker can detect drift.
const PUBLIC_AGENT_SKILLS = [
  'weapp-vite-best-practices',
  'weapp-acceptance',
  'docs-and-website-sync',
  'release-and-changeset-best-practices',
  'weapp-devtools-e2e-best-practices',
  'weapp-vite-vue-sfc-best-practices',
  'weapp-vite-react-best-practices',
  'wevu-best-practices',
  'native-to-weapp-vite-wevu-migration',
] as const

/**
 * @description 根据模板 profile 返回生成的 AGENTS 指引。
 */
export function createAgentsGuidelines(templateName: TemplateName, toolchain: Toolchain = 'wv') {
  const guidelines = generatedAgentGuidelines[templateName] ?? generatedAgentGuidelines.default
  if (!guidelines) {
    throw new Error(`missing generated AGENTS profile: ${templateName}`)
  }
  if (toolchain === 'wv') {
    return guidelines
  }
  const hosted = guidelines.replace(
    '- Keep `vite.config.ts` as the source of truth for `weapp` config, output behavior, and IDE/MCP automation.',
    '- Keep shared mini-program configuration in `weapp-vite.config.ts`; the `vite*.config.ts` host entries import it explicitly. Use project `dev`/`build` scripts for the selected host and `wv prepare/open/upload/mcp` for mini-program tooling. Do not pass `wv --platform` flags to Vite or Vite+.',
  )
  if (toolchain !== 'vite-plus') {
    return hosted
  }
  return `${hosted.replace(
    /- 项目 ESLint 配置应接入[^\n]+/,
    '- 项目通过 `@weapp-vite/oxlint` 检查小程序运行时 API；仅检查业务运行时代码，排除 config、构建脚本、测试、Web-only、WXS 和生成产物。Vue 模板专项规则仍由 `pnpm lint:vue` 执行。',
  )}\n## Vite Plus Code Quality\n\n- Use \`pnpm lint\` / \`pnpm lint:fix\` for Oxlint plus native template/module diagnostics, \`pnpm format\` / \`pnpm format:check\` for Oxfmt, and \`pnpm stylelint\` for styles. Run \`pnpm lint:vue\` when that script exists.\n- Configure \`lint\` and \`fmt\` in \`vite.config.ts\` using \`@weapp-vite/oxlint\` and \`@weapp-vite/oxfmt\`. Do not add competing formatter configurations. Native templates and script modules use the shared language adapters through project lint/format/check commands; raw vp commands only cover their standard files. Native styles use CSS associations with semantic checks from Stylelint. Configure platform and per-file overrides in \`weapp.language\`; ambiguous SJS requires an explicit owner.\n- \`pnpm check\` follows the workspace root policy when present; member presets cannot override that policy. Keep type checking as a separate project command.\n`
}

export { PUBLIC_AGENT_SKILLS }
