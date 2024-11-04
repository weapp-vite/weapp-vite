import type { Buffer } from 'node:buffer'
import { Parser } from 'htmlparser2'
import MagicString from 'magic-string'

// https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html
export function processWxml(wxml: string | Buffer) {
  const ms = new MagicString(wxml.toString())
  // transformOn
  // https://github.com/vuejs/core/blob/76c43c6040518c93b41f60a28b224f967c007fdf/packages/compiler-core/src/transforms/vOn.ts
  const parser = new Parser({
    onattribute(name, _value, _quote) {
      // 事件绑定
      if (name.startsWith('@')) {
        const start = parser.startIndex
        const end = parser.startIndex + name.length
        const { dir, mods } = name.split('.')
          .filter(x => x)
          .reduce<{ dir: string, mods: Record<string, boolean> }>((acc, cur, idx) => {
            if (idx === 0) {
              acc.dir = cur
            }
            else {
              acc.mods[cur] = true
            }
            return acc
          }, { dir: '', mods: {} })

        let rep: string
        if (mods.catch && mods.capture) {
          rep = `capture-catch:${dir.slice(1)}`
        }
        else if (mods.catch) {
          rep = `catch:${dir.slice(1)}`
        }
        else if (mods.mut) {
          rep = `mut-bind:${dir.slice(1)}`
        }
        else if (mods.capture) {
          rep = `capture-bind:${dir.slice(1)}`
        }
        else {
          rep = `bind:${dir.slice(1)}`
        }
        if (rep) {
          ms.update(start, end, rep)
        }
      }
    },
  })
  parser.write(
    ms.original,
  )
  parser.end()
  return {
    code: ms.toString(),
  }
}
