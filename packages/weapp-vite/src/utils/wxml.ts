import type { Buffer } from 'node:buffer'
import { removeExtension } from '@weapp-core/shared'
import { Parser } from 'htmlparser2'
import MagicString from 'magic-string'

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

export function processWxml(wxml: string | Buffer) {
  const ms = new MagicString(wxml.toString())
  const deps: WxmlDep[] = []
  let currentTagName = ''
  let importAttrs: undefined | string[]
  const parser = new Parser({
    onopentagname(name) {
      currentTagName = name
      importAttrs = srcImportTagsMap[currentTagName]
    },
    onattribute(name, value, quote) {
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
            return
          }
        }
      }
    },
    // ontext(data) {
    //   console.log('ontext', data)
    // },
    onclosetag() {
      currentTagName = ''
      importAttrs = undefined
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
