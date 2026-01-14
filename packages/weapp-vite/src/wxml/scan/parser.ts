import type { ComponentsMap, WxmlDep } from '../../types'
import type { Token } from '../shared'
import type { RemovalRange, WxmlToken } from './types'
import { Parser } from 'htmlparser2'
import { jsExtensions } from '../../constants'
import { srcImportTagsMap } from '../shared'
import { resolveEventDirectiveName } from './events'

interface ParserResult {
  token: WxmlToken
}

interface ParserOptions {
  source: string
  platform: string
  excludeComponent: (tagName: string) => boolean
}

export function parseWxml(options: ParserOptions): ParserResult {
  const { source, platform, excludeComponent } = options
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
          const rep = resolveEventDirectiveName(name)
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
        if (currentTagName && !excludeComponent(currentTagName)) {
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
          if (match[1] !== platform) {
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

  return { token }
}
