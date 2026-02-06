import type { ComponentsMap, MpPlatform, WxmlDep } from '../../types'
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
  platform: MpPlatform
  excludeComponent: (tagName: string) => boolean
}

function toKebabCaseTagName(tagName: string) {
  return tagName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

function shouldNormalizeTagNameForAlipay(tagName: string) {
  return /[A-Z]/.test(tagName)
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
  // 脚本模块标签替换（wxs/sjs）
  const scriptModuleTagTokens: Token[] = []
  // 处理 xxx.wxs.ts 转变为合法引用
  const wxsImportNormalizeTokens: Token[] = []
  // 移除内联 wxs 的 lang 属性
  const removeWxsLangAttrTokens: Token[] = []
  // 模板 import/include 的扩展名替换
  const templateImportNormalizeTokens: Token[] = []
  // 事件转义
  const eventTokens: Token[] = []
  // 平台模板指令（wx:* -> a:*）
  const directiveTokens: Token[] = []
  // 平台标签名（HelloWorld -> hello-world）
  const tagNameTokens: Token[] = []
  // 标签调用栈（tag stack）
  const tagStack: string[] = []
  const scriptModuleTags = new Set(['wxs', 'sjs'])
  const parser = new Parser(
    {
      onopentagname(name) {
        tagStack.push(name)
        currentTagName = name
        importAttrs = srcImportTagsMap[currentTagName]
        tagStartIndex = parser.startIndex
        if (platform === 'alipay' && shouldNormalizeTagNameForAlipay(name)) {
          const normalized = toKebabCaseTagName(name)
          if (normalized !== name) {
            tagNameTokens.push({
              start: parser.startIndex + 1,
              end: parser.startIndex + 1 + name.length,
              value: normalized,
            })
          }
        }
        if (scriptModuleTags.has(name)) {
          scriptModuleTagTokens.push({
            start: parser.startIndex + 1,
            end: parser.startIndex + 1 + name.length,
            value: name,
          })
        }
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
              if (currentTagName && scriptModuleTags.has(currentTagName) && name === 'src') {
                if (/\.(?:wxs|sjs)(?:\.[jt]s)?$/i.test(value)) {
                  const valueStart = parser.startIndex + name.length + 2
                  wxsImportNormalizeTokens.push(
                    {
                      start: valueStart,
                      end: parser.endIndex - 1,
                      value,
                    },
                  )
                }
              }
            }
            if ((currentTagName === 'import' || currentTagName === 'include') && name === 'src') {
              if (/\.(?:wxml|html)$/i.test(value)) {
                const valueStart = parser.startIndex + name.length + 2
                templateImportNormalizeTokens.push({
                  start: valueStart,
                  end: parser.endIndex - 1,
                  value,
                })
              }
            }
          }
        }
        // 事件绑定
        {
          const start = parser.startIndex
          const end = parser.startIndex + name.length
          const rep = resolveEventDirectiveName(name, platform)
          if (rep && rep !== name) {
            eventTokens.push({
              start,
              end,
              value: rep,
            })
          }
        }
        if (platform === 'alipay' && name.startsWith('wx:')) {
          const start = parser.startIndex
          const end = parser.startIndex + name.length
          directiveTokens.push({
            start,
            end,
            value: `a:${name.slice(3)}`,
          })
        }
        // 移除内联 wxs 的 lang
        if (currentTagName && scriptModuleTags.has(currentTagName) && name === 'lang' && jsExtensions.includes(value)) {
          removeWxsLangAttrTokens.push({
            start: parser.startIndex,
            end: parser.endIndex,
            value,
          })
        }
      },
      onclosetag(name) {
        currentTagName = tagStack.pop()
        if (currentTagName && !excludeComponent(currentTagName)) {
          const componentName = platform === 'alipay' && shouldNormalizeTagNameForAlipay(currentTagName)
            ? toKebabCaseTagName(currentTagName)
            : currentTagName
          if (Array.isArray(components[componentName])) {
            components[componentName].push({
              start: tagStartIndex,
              end: parser.endIndex + 1,
            })
          }
          else {
            components[componentName] = [{
              start: tagStartIndex,
              end: parser.endIndex + 1,
            }]
          }
        }

        if (platform === 'alipay' && shouldNormalizeTagNameForAlipay(name)) {
          const normalized = toKebabCaseTagName(name)
          if (normalized !== name && parser.startIndex !== tagStartIndex) {
            const nameStart = parser.startIndex + 2
            tagNameTokens.push({
              start: nameStart,
              end: nameStart + name.length,
              value: normalized,
            })
          }
        }

        if (currentTagName && scriptModuleTags.has(currentTagName)) {
          if (parser.startIndex !== tagStartIndex) {
            const nameStart = parser.startIndex + 2
            scriptModuleTagTokens.push({
              start: nameStart,
              end: nameStart + currentTagName.length,
              value: currentTagName,
            })
          }
        }

        currentTagName = ''
        attrs = {}
        importAttrs = undefined
        tagStartIndex = 0
      },
      ontext(data) {
        if (currentTagName && scriptModuleTags.has(currentTagName) && jsExtensions.includes(attrs.lang)) {
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
    templateImportNormalizeTokens,
    scriptModuleTagTokens,
    eventTokens,
    directiveTokens,
    tagNameTokens,
    code: source,
  }

  return { token }
}
