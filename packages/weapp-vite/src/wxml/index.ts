import type { Buffer } from 'node:buffer'
import { removeExtension } from '@weapp-core/shared'
import { Parser } from 'htmlparser2'
import MagicString from 'magic-string'
import { transformWxsCode } from '../wxs'

const srcImportTagsMap: Record<string, string[]> = {
  // audio: ['src', 'poster'],
  // video: ['src', 'poster'],
  // image: ['src'],
  // https://developers.weixin.qq.com/miniprogram/dev/reference/wxs/01wxs-module.html
  wxs: ['src'],
  // https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/import.html
  // import: ['src'],
  // include: ['src'],
}

export interface WxmlDep {
  tagName: string
  start: number
  end: number
  quote: string | null | undefined
  name: string
  value: string
}
// https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html
export function processWxml(wxml: string | Buffer) {
  const ms = new MagicString(wxml.toString())
  const deps: WxmlDep[] = []
  let currentTagName = ''
  let importAttrs: undefined | string[]
  let attributes: Record<string, string> = {}
  // transformOn
  // https://github.com/vuejs/core/blob/76c43c6040518c93b41f60a28b224f967c007fdf/packages/compiler-core/src/transforms/vOn.ts
  const parser = new Parser({
    onopentagname(name) {
      currentTagName = name
      importAttrs = srcImportTagsMap[currentTagName]
    },
    onattribute(name, value, quote) {
      attributes[name] = value
      if (importAttrs) {
        for (const attrName of importAttrs) {
          if (attrName === name) {
            deps.push({
              name,
              value,
              quote,
              tagName: currentTagName,
              start: parser.startIndex,
              end: parser.endIndex,
            })
            if (currentTagName === 'wxs' && name === 'src') {
              if (/\.wxs.[jt]s$/.test(value)) {
                // 5 是 'src="'.length
                // 1 是 '"'.length
                ms.update(parser.startIndex + 5, parser.endIndex - 1, removeExtension(value))
              }
            }
          }
        }
      }
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
    onclosetag() {
      currentTagName = ''
      attributes = {}
      importAttrs = undefined
    },
    ontext(data) {
      if (currentTagName === 'wxs' && attributes.lang) {
        // data
        const res = transformWxsCode(data)
        if (res && res.code) {
          ms.update(parser.startIndex, parser.endIndex, `\n${res.code}`)
        }
      }
    },
  })
  parser.write(
    ms.original,
  )
  parser.end()
  return {
    deps,
    code: ms.toString(),
  }
}
