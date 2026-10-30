import { miniProgramRuntimePlugin, wevuCompatibilityPlugin } from '@weapp-vite/eslint'

/** 复用 ESLint 的脚本规则及能力清单；Vue 模板规则仍由 vue-eslint-parser 执行。 */
const plugin = {
  meta: { name: 'weapp-vite' },
  rules: {
    ...miniProgramRuntimePlugin.rules,
    'no-unsupported-api': wevuCompatibilityPlugin.rules['no-unsupported-api'],
    'no-risky-api': wevuCompatibilityPlugin.rules['no-risky-api'],
  },
}

export default plugin
