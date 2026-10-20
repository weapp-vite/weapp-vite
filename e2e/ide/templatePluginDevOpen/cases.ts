import type { PluginProjectLayout } from '../../utils/pluginOpenEvidence'
import path from 'node:path'

export const PLUGIN_TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../../templates/weapp-vite-plugin-template')
export const PLUGIN_TEMPLATE_ROUTE = '/pages/index/index'

/** 默认 CLI 保持原项目合同；布局检查不再隐式决定启动策略。 */
export function createPluginTemplateDevOpenArgs(layout: PluginProjectLayout) {
  return ['exec', 'wv', 'dev', ...(layout === 'snapshot' ? ['--ide-open-strategy', 'automator'] : []), '-o', '--non-interactive', '--login-retry', 'never']
}
