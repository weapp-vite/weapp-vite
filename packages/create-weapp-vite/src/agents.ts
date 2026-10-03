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
  return guidelines.replace(
    '- Keep `vite.config.ts` as the source of truth for `weapp` config, output behavior, and IDE/MCP automation.',
    '- Keep shared mini-program configuration in `weapp-vite.config.ts`; the `vite*.config.ts` host entries import it explicitly. Use project `dev`/`build` scripts for the selected host and `wv prepare/open/upload/mcp` for mini-program tooling. Do not pass `wv --platform` flags to Vite or Vite+.',
  )
}

export { PUBLIC_AGENT_SKILLS }
