import type { PluginCreator } from 'postcss'
import { cssAtRulePrefix } from '../constants'

export const postCreator: PluginCreator<unknown> = () => {
  return {
    postcssPlugin: 'postcss-weapp-vite-plugin-post',
    //  /^wv-/
    OnceExit(root) {
      root.walkAtRules(new RegExp(`^${cssAtRulePrefix}-`), (rule) => {
        if (rule.name === `${cssAtRulePrefix}-keep-import`) {
          rule.name = 'import'
        }
      })
    },
  }
}

postCreator.postcss = true
