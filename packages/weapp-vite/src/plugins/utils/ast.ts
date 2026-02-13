import type { Program } from '@oxc-project/types'
import { walk } from 'oxc-walker'

export interface RequireToken {
  start: number
  end: number
  value: string
  async?: boolean
}

export function collectRequireTokens(ast: unknown) {
  const requireTokens: RequireToken[] = []

  // Rollup/Vite parse may use a different @oxc-project/types version.
  walk(ast as Program, {
    enter(node) {
      if (node.type === 'CallExpression') {
        // 普通情况下的 require 分析被废弃
        // 参考：https://developers.weixin.qq.com/miniprogram/dev/reference/api/require.html#require-async-%E9%93%BE%E5%BC%8F%E8%B0%83%E7%94%A8
        if (
          node.callee.type === 'MemberExpression'
          && node.callee.object.type === 'Identifier'
          && node.callee.object.name === 'require'
          && node.callee.property.type === 'Identifier'
          && node.callee.property.name === 'async'
        ) {
          const argv0 = node.arguments[0]
          if (argv0 && argv0.type === 'Literal' && typeof argv0.value === 'string') {
            requireTokens.push({
              start: argv0.start,
              end: argv0.end,
              value: argv0.value,
              async: true,
            })
          }
        }
      }
    },
  })

  return {
    requireTokens,
  }
}
