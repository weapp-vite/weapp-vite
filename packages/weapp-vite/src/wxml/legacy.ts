import type { Buffer } from 'node:buffer'
import type { ComponentsMap, ProcessWxmlOptions, WxmlDep } from '../types'
import { defu } from '@weapp-core/shared'
import { Parser } from 'htmlparser2'
import MagicString from 'magic-string'
import { isBuiltinComponent } from '../auto-import-components/builtin'
import { jsExtensions } from '../constants'
import { normalizeWxsFilename, transformWxsCode } from '../wxs'
import { srcImportTagsMap } from './shared'

// https://github.com/fb55/htmlparser2/issues/1541
// https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html
export function processWxml(wxml: string | Buffer, options?: ProcessWxmlOptions) {
  const opts = defu<Required<ProcessWxmlOptions>, ProcessWxmlOptions[]>(options, {
    excludeComponent: (tagName) => {
      return isBuiltinComponent(tagName)
    },
    platform: 'weapp',
    removeComment: true,
  })
  const ms = new MagicString(wxml.toString())
  const deps: WxmlDep[] = []
  let currentTagName = ''
  let importAttrs: undefined | string[]
  let attrs: Record<string, string> = {}
  const components: ComponentsMap = {}
  let tagStartIndex = 0
  // transformOn
  // https://github.com/vuejs/core/blob/76c43c6040518c93b41f60a28b224f967c007fdf/packages/compiler-core/src/transforms/vOn.ts

  const removeStartStack: number[] = []
  const removeEndStack: number[] = []
  const commentsPositions: { start: number, end: number }[] = []
  const parser = new Parser(
    {
      onopentagname(name) {
        currentTagName = name
        importAttrs = srcImportTagsMap[currentTagName]
        tagStartIndex = parser.startIndex
      },
      onattribute(name, value, quote) {
        attrs[name] = value
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
                attrs,
              })
              if (currentTagName === 'wxs' && name === 'src') {
                if (/\.wxs.[jt]s$/.test(value)) {
                  // 5 是 'src="'.length
                  // 1 是 '"'.length
                  ms.update(parser.startIndex + 5, parser.endIndex - 1, normalizeWxsFilename(value))
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
        // 移除内联 wxs 的 lang
        if (currentTagName === 'wxs' && name === 'lang' && jsExtensions.includes(value)) {
          ms.update(parser.startIndex, parser.endIndex, '')
        }
      },
      onclosetag() {
        if (currentTagName && !opts.excludeComponent(currentTagName)) {
          if (Array.isArray(components[currentTagName])) {
            components[currentTagName].push({
              start: tagStartIndex,
              end: parser.endIndex + 1,
            })
          }
          else {
            components[currentTagName] = [{
              start: tagStartIndex,
              end: parser.endIndex + 1,
            }]
          }
        }

        currentTagName = ''
        attrs = {}
        importAttrs = undefined
        tagStartIndex = 0
      },
      ontext(data) {
        if (currentTagName === 'wxs' && jsExtensions.includes(attrs.lang)) {
          // data
          const res = transformWxsCode(data)
          if (res?.code) {
            ms.update(parser.startIndex, parser.endIndex, `\n${res.code}`)
          }
        }
      },
      // <!--  #ifdef  %PLATFORM% -->
      // 平台特有的组件
      // <!--  #endif -->
      oncomment(data) {
        let match = /#ifdef\s+(\w+)/.exec(data)
        if (match) {
          if (match[1] !== opts.platform) {
            removeStartStack.push(parser.startIndex)
          }
        }
        match = /#endif/.exec(data)
        if (match) {
          removeEndStack.push(parser.endIndex + 1)
        }
        commentsPositions.push({
          start: parser.startIndex,
          end: parser.endIndex + 1,
        })
      },
    },
    {
      lowerCaseTags: false,
      xmlMode: true,
    },
  )
  parser.write(
    ms.original,
  )
  parser.end()

  for (let i = 0; i < removeStartStack.length; i++) {
    const startIndex = removeStartStack[i]
    for (let j = i; j < removeEndStack.length; j++) {
      const endIndex = removeEndStack[j]
      if (endIndex > startIndex) {
        ms.remove(startIndex, endIndex)
        break
      }
    }
  }
  // remove comments
  if (opts.removeComment) {
    for (const { end, start } of commentsPositions) {
      ms.remove(start, end)
    }
  }

  return {
    components,
    deps,
    code: ms.toString(),
    removeStartStack,
    removeEndStack,
  }
}
