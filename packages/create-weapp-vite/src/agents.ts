import type { TemplateName } from './enums'
import { generatedAgentGuidelines } from './generated/agents'

// Public skill names remain explicit here so the repository contract checker can detect drift.
const PUBLIC_AGENT_SKILLS = [
  'weapp-vite-best-practices',
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
export function createAgentsGuidelines(templateName: TemplateName) {
  const guidelines = generatedAgentGuidelines[templateName] ?? generatedAgentGuidelines.default
  if (!guidelines) {
    throw new Error(`missing generated AGENTS profile: ${templateName}`)
  }
  return guidelines
}

export { PUBLIC_AGENT_SKILLS }
