import type { Buffer } from 'node:buffer'
import type { ComponentsMap, ScanWxmlOptions, WxmlDep } from '../types'
import type { Token } from './shared'
import { defu } from '@weapp-core/shared'
import { Parser } from 'htmlparser2'
import { LRUCache } from 'lru-cache'
import { isBuiltinComponent } from '../auto-import-components/builtin'
import { jsExtensions } from '../constants'
import { srcImportTagsMap } from './shared'

export interface RemovalRange {
  start: number
  end: number
}

export interface WxmlToken {
  components: ComponentsMap
  deps: WxmlDep[]
  removalRanges: RemovalRange[]
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

function fnv1aHash(input: string) {
  let hash = 0x811C9DC5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

function createCacheKey(source: string, platform: string) {
  return `${platform}:${source.length.toString(36)}:${fnv1aHash(source)}`
}

function resolveEventDirective(raw: string) {
  if (!raw.startsWith('@')) {
    return undefined
  }

  let dir = ''
  let segment = ''
  let hasCatch = false
  let hasCapture = false
  let hasMut = false

  const flush = () => {
    if (!segment) {
      return
    }
    if (!dir) {
      dir = segment
    }
    else {
      if (segment === 'catch') {
        hasCatch = true
      }
      else if (segment === 'capture') {
        hasCapture = true
      }
      else if (segment === 'mut') {
        hasMut = true
      }
    }
    segment = ''
  }

  for (let i = 1; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '.') {
      flush()
    }
    else {
      segment += ch
    }
  }
  flush()

  if (!dir) {
    return undefined
  }

  let prefix = 'bind'
  if (hasCatch && hasCapture) {
    prefix = 'capture-catch'
  }
  else if (hasCatch) {
    prefix = 'catch'
  }
  else if (hasMut) {
    prefix = 'mut-bind'
  }
  else if (hasCapture) {
    prefix = 'capture-bind'
  }

  return `${prefix}:${dir}`
}

export function defaultExcludeComponent(tagName: string) {
  return isBuiltinComponent(tagName)
}

export function scanWxml(wxml: string | Buffer, options?: ScanWxmlOptions) {
  const source = typeof wxml === 'string' ? wxml : wxml.toString()
  const opts = defu<Required<ScanWxmlOptions>, ScanWxmlOptions[]>(options, {
    excludeComponent: defaultExcludeComponent,
    platform: 'weapp',
  })
  const canUseCache = opts.excludeComponent === defaultExcludeComponent
  const cacheKey = canUseCache ? createCacheKey(source, opts.platform) : undefined
  if (cacheKey) {
    const cached = scanWxmlCache.get(cacheKey)
    if (cached) {
      return cached
    }
  }
  const deps: WxmlDep[] = []
  let currentTagName: string | undefined
  let importAttrs: undefined | string[]
  let attrs: Record<string, string> = {}
  const components: ComponentsMap = {}
  let tagStartIndex = 0
  // 事件处理转换（transformOn）
  // 参考：https://github.com/vuejs/core/blob/76c43c6040518c93b41f60a28b224f967c007fdf/packages/compiler-core/src/transforms/vOn.ts

  // 条件编译注释
  const removalRanges: RemovalRange[] = []
  const conditionalStack: number[] = []
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
  // 标签调用栈（tag stack）
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
          const rep = resolveEventDirective(name)
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
            conditionalStack.push(parser.startIndex)
          }
        }
        match = /#endif/.exec(data)
        if (match) {
          const start = conditionalStack.pop()
          if (start !== undefined) {
            removalRanges.push({
              start,
              end: parser.endIndex + 1,
            })
          }
        }
        commentTokens.push({
          start: parser.startIndex,
          end: parser.endIndex + 1,
          value: '',
        })
      },
    },
    {
      lowerCaseTags: false,
      xmlMode: true,
    },
  )
  parser.write(
    source,
  )
  parser.end()

  if (removalRanges.length > 1) {
    removalRanges.sort((a, b) => b.start - a.start)
  }

  const token: WxmlToken = {
    components,
    deps,
    removalRanges,
    commentTokens,
    inlineWxsTokens,
    wxsImportNormalizeTokens,
    removeWxsLangAttrTokens,
    eventTokens,
    code: source,
  }
  if (cacheKey) {
    scanWxmlCache.set(cacheKey, token)
  }
  return token
}

export type ScanWxmlResult = ReturnType<typeof scanWxml>
