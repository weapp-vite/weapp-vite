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
      // console.log(name, value, quote, ms.slice(parser.startIndex, parser.startIndex + name.length)) //  parser.endIndex
      if (name.startsWith('@')) {
        const start = parser.startIndex
        const end = parser.startIndex + name.length
        const [dir, ...mods] = name.split('.')
        if (mods[0] === 'catch') {
          if (mods[1] === 'capture') {
            ms.update(start, end, `capture-catch:${dir.slice(1)}`)
          }
          else {
            ms.update(start, end, `catch:${dir.slice(1)}`)
          }
        }
        else if (mods[0] === 'mut') {
          ms.update(start, end, `mut-bind:${dir.slice(1)}`)
        }
        else if (mods[0] === 'capture') {
          if (mods[1] === 'catch') {
            ms.update(start, end, `capture-catch:${dir.slice(1)}`)
          }
          else {
            ms.update(start, end, `capture-bind:${dir.slice(1)}`)
          }
        }
        else {
          ms.update(start, end, `bind:${dir.slice(1)}`)
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
