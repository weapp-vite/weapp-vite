import type { PluginCreator } from 'postcss'

export const postCreator: PluginCreator<unknown> = () => {
  return {
    postcssPlugin: 'postcss-weapp-vite-plugin-post',
    OnceExit(root) {
      root.walkAtRules(/^weapp-vite/, (rule) => {
        if (rule.name === 'weapp-vite-keep-import') {
          rule.name = 'import'
        }
      })
    },
  }
}

postCreator.postcss = true
