import type { MpPlatform } from '@/types'
import type { PluginCreator } from 'postcss'
import { cssAtRulePrefix, ENDIF, IFDEF, IFNDEF } from './constants'

export const postCreator: PluginCreator<{ platform: MpPlatform }> = (options = { platform: 'weapp' }) => {
  const atRulePrefixRegExp = new RegExp(`^${cssAtRulePrefix}-`)
  return {
    postcssPlugin: 'postcss-weapp-vite-plugin-post',
    prepare() {
      return {
        AtRule(atRule) {
          if (atRulePrefixRegExp.test(atRule.name)) {
            if (atRule.name === `${cssAtRulePrefix}-keep-import`) {
              atRule.name = 'import'
            }
            // @wv-if (<supports-condition>) and (<supports-condition>) {
            //   /* If both conditions are true, use the CSS in this block. */
            // }
            else if (atRule.name === `${cssAtRulePrefix}-if`) {
              const matches = atRule.params.matchAll(/\((\w+)\)/g)
              const isRemove = [...matches].every(x => x[1] !== options.platform)
              if (isRemove) {
                atRule.remove()
              }
              else {
                atRule.replaceWith(atRule.nodes)
              }
            }
          }
        },
        Comment(comment) {
          // #ifdef  %PLATFORM%
          // 平台特有样式
          // #endif
          const wordList = comment.text.split(' ')
          // 指定平台保留
          if (wordList.includes(IFDEF)) {
            // 非指定平台
            if (!wordList.includes(options.platform)) {
              let next = comment.next()
              while (next) {
                if (next.type === 'comment' && next.text.trim() === ENDIF) {
                  break
                }
                const temp = next.next()
                next.remove()
                next = temp
              }
            }
          }

          // ifndef  %PLATFORM%
          // 平台特有样式
          // #endif
          // 指定平台剔除
          if (wordList.includes(IFNDEF)) {
            // 指定平台
            if (wordList.includes(options.platform)) {
              let next = comment.next()
              while (next) {
                if (next.type === 'comment' && next.text.trim() === ENDIF) {
                  break
                }
                const temp = next.next()
                next.remove()
                next = temp
              }
            }
          }

          comment.remove()
        },
      }
    },
  }
}

postCreator.postcss = true
