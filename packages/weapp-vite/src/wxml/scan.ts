import type { ComponentsMap, ScanWxmlOptions, WxmlDep } from '@/types'
import type { Buffer } from 'node:buffer'
import type { Token } from './shared'
import { isBuiltinComponent } from '@/auto-import-components/builtin'
import { jsExtensions } from '@/constants'
import { defu, objectHash } from '@weapp-core/shared'
import { Parser } from 'htmlparser2'
import { LRUCache } from 'lru-cache'
import { srcImportTagsMap } from './shared'

export interface WxmlToken {
  components: ComponentsMap
  deps: WxmlDep[]
  removeStartStack: number[]
  removeEndStack: number[]
  commentTokens: Token[]
  inlineWxsTokens: Token[]
  wxsImportNormalizeTokens: Token[]
  removeWxsLangAttrTokens: Token[]
  eventTokens: Token[]
  code: string
}

export const scanWxmlCache = new LRUCache<string, WxmlToken>(
  {
    max: 512,
  },
)

function getCacheKey(wxml: string | Buffer, options?: ScanWxmlOptions) {
  return objectHash({
    wxml: wxml.toString(),
    options,
  })
}

export function defaultExcludeComponent(tagName: string) {
  return isBuiltinComponent(tagName)
}

export function scanWxml(wxml: string | Buffer, options?: ScanWxmlOptions) {
  const opts = defu<Required<ScanWxmlOptions>, ScanWxmlOptions[]>(options, {
    excludeComponent: defaultExcludeComponent,
    platform: 'weapp',
  })
  const cacheKey = getCacheKey(wxml, opts)
  const t = scanWxmlCache.get(cacheKey)
  if (t) {
    return t
  }
  const ms = wxml.toString()
  const deps: WxmlDep[] = []
  let currentTagName: string | undefined
  let importAttrs: undefined | string[]
  let attrs: Record<string, string> = {}
  const components: ComponentsMap = {}
  let tagStartIndex = 0
  // transformOn
  // https://github.com/vuejs/core/blob/76c43c6040518c93b41f60a28b224f967c007fdf/packages/compiler-core/src/transforms/vOn.ts

  // 条件编译注释
  const removeStartStack: number[] = []
  const removeEndStack: number[] = []
  // 注释
  const commentTokens: Token[] = []
  // 内联wxs
  const inlineWxsTokens: Token[] = []
  // 处理 xxx.wxs.ts 转变为合法引用
  const wxsImportNormalizeTokens: Token[] = []
  // 移除内联 wxs 的 lang 属性
  const removeWxsLangAttrTokens: Token[] = []
  // 事件转义
  const eventTokens: Token[] = []
  // tag 调用栈
  const tagStack: string[] = []
  const parser = new Parser(
    {
      onopentagname(name) {
        tagStack.push(name)
        currentTagName = name
        importAttrs = srcImportTagsMap[currentTagName]
        tagStartIndex = parser.startIndex
      },
      onattribute(name, value, quote) {
        attrs[name] = value
        if (importAttrs && currentTagName) {
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
                  wxsImportNormalizeTokens.push(
                    {
                      start: parser.startIndex + 5,
                      end: parser.endIndex - 1,
                      value,
                    },
                  )
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
            eventTokens.push({
              start,
              end,
              value: rep,
            })
          }
        }
        // 移除内联 wxs 的 lang
        if (currentTagName === 'wxs' && name === 'lang' && jsExtensions.includes(value)) {
          removeWxsLangAttrTokens.push({
            start: parser.startIndex,
            end: parser.endIndex,
            value,
          })
        }
      },
      onclosetag() {
        currentTagName = tagStack.pop()
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
          inlineWxsTokens.push({
            start: parser.startIndex,
            end: parser.endIndex,
            value: data,
          })
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
        commentTokens.push({
          start: parser.startIndex,
          end: parser.endIndex + 1,
          value: data,
        })
      },
    },
    {
      lowerCaseTags: false,
      xmlMode: true,
    },
  )
  parser.write(
    ms,
  )
  parser.end()

  const token: WxmlToken = {
    components,
    deps,
    removeStartStack,
    removeEndStack,
    commentTokens,
    inlineWxsTokens,
    wxsImportNormalizeTokens,
    removeWxsLangAttrTokens,
    eventTokens,
    code: ms,
  }
  scanWxmlCache.set(cacheKey, token)
  return token
}

export type ScanWxmlResult = ReturnType<typeof scanWxml>
