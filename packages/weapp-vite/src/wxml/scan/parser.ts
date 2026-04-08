import type { ComponentsMap, MpPlatform, WxmlDep } from '../../types'
import type { Token } from '../shared'
import type { RemovalRange, WxmlToken } from './types'
import { Parser } from 'htmlparser2'
import { jsExtensions } from '../../constants'
import { getWxmlPlatformTransformOptions } from '../../platform'
import {
  getScriptModuleImportAttrs,
  isScriptModuleImportAttr,
  isScriptModuleTagName,
} from '../../utils/wxmlScriptModule'
import {
  getTemplateImportAttrs,
  isTemplateImportAttr,
  shouldNormalizeTemplateImportSource,
} from '../shared'
import { resolveEventDirectiveName } from './events'

const TAG_NAME_LOWER_TO_UPPER_RE = /([a-z0-9])([A-Z])/g
const TAG_NAME_MULTI_UPPER_RE = /([A-Z]+)([A-Z][a-z])/g
const TAG_NAME_HAS_UPPER_RE = /[A-Z]/
const SCRIPT_MODULE_IMPORT_RE = /\.(?:wxs|sjs)(?:\.[jt]s)?$/i
const COMMENT_IFDEF_RE = /#ifdef\s+(\w+)/
const COMMENT_ENDIF_RE = /#endif/

interface ParserResult {
  token: WxmlToken
}

interface ParserOptions {
  source: string
  platform: MpPlatform
  /**
   * @description 判断某个标签是否应从常规组件分析结果中排除。
   * 这里通常会过滤微信内置组件，避免把它们误当成用户组件写入 `usingComponents`。
   */
  excludeComponent: (tagName: string) => boolean
}

function toKebabCaseTagName(tagName: string) {
  return tagName
    .replace(TAG_NAME_LOWER_TO_UPPER_RE, '$1-$2')
    .replace(TAG_NAME_MULTI_UPPER_RE, '$1-$2')
    .toLowerCase()
}

function shouldNormalizeTagName(tagName: string) {
  return TAG_NAME_HAS_UPPER_RE.test(tagName)
}

export function parseWxml(options: ParserOptions): ParserResult {
  const { source, platform, excludeComponent } = options
  const { directivePrefix, normalizeComponentTagName } = getWxmlPlatformTransformOptions(platform)
  const deps: WxmlDep[] = []
  let currentTagName: string | undefined
  let importAttrs: undefined | string[]
  let attrs: Record<string, string> = {}
  // 常规组件索引：会排除内置组件，供现有组件聚合与 usingComponents 推断使用。
  const components: ComponentsMap = {}
  // 自动导入组件索引：保留所有标签，供 auto-import 在重名场景下优先匹配用户组件。
  const autoImportComponents: ComponentsMap = {}
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
  const parser = new Parser(
    {
      onopentagname(name) {
        tagStack.push(name)
        currentTagName = name
        importAttrs = getScriptModuleImportAttrs(currentTagName) ?? getTemplateImportAttrs(currentTagName)
        tagStartIndex = parser.startIndex
        if (normalizeComponentTagName && shouldNormalizeTagName(name)) {
          const normalized = toKebabCaseTagName(name)
          if (normalized !== name) {
            tagNameTokens.push({
              start: parser.startIndex + 1,
              end: parser.startIndex + 1 + name.length,
              value: normalized,
            })
          }
        }
        if (isScriptModuleTagName(name)) {
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
              const matchesScriptModuleImportAttr = isScriptModuleImportAttr(currentTagName, name)
              if (matchesScriptModuleImportAttr) {
                if (SCRIPT_MODULE_IMPORT_RE.test(value)) {
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
              if (isTemplateImportAttr(currentTagName, name) && shouldNormalizeTemplateImportSource(value)) {
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
        if (directivePrefix !== 'wx' && name.startsWith('wx:')) {
          const start = parser.startIndex
          const end = parser.startIndex + name.length
          directiveTokens.push({
            start,
            end,
            value: `${directivePrefix}:${name.slice(3)}`,
          })
        }
        // 移除内联 wxs 的 lang
        if (currentTagName && isScriptModuleTagName(currentTagName) && name === 'lang' && jsExtensions.includes(value)) {
          removeWxsLangAttrTokens.push({
            start: parser.startIndex,
            end: parser.endIndex,
            value,
          })
        }
      },
      onclosetag(name) {
        currentTagName = tagStack.pop()
        if (currentTagName) {
          const componentName = normalizeComponentTagName && shouldNormalizeTagName(currentTagName)
            ? toKebabCaseTagName(currentTagName)
            : currentTagName
          // 同一份位置信息会同时写入两套索引，避免为 auto-import 再额外扫描一遍 WXML。
          const range = {
            start: tagStartIndex,
            end: parser.endIndex + 1,
          }

          // 自动导入索引保留完整标签集，这样即便标签名与内置组件重名，也还能交给 resolver 判断是否存在用户组件。
          if (Array.isArray(autoImportComponents[componentName])) {
            autoImportComponents[componentName].push(range)
          }
          else {
            autoImportComponents[componentName] = [range]
          }

          // 常规索引继续沿用历史行为，过滤掉内置组件，避免污染普通 usingComponents 推断。
          if (!excludeComponent(currentTagName)) {
            if (Array.isArray(components[componentName])) {
              components[componentName].push(range)
            }
            else {
              components[componentName] = [range]
            }
          }
        }

        if (normalizeComponentTagName && shouldNormalizeTagName(name)) {
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

        if (currentTagName && isScriptModuleTagName(currentTagName)) {
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
        if (currentTagName && isScriptModuleTagName(currentTagName) && jsExtensions.includes(attrs.lang)) {
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
        let match = COMMENT_IFDEF_RE.exec(data)
        if (match) {
          if (match[1] !== platform) {
            conditionalStack.push(parser.startIndex)
          }
        }
        match = COMMENT_ENDIF_RE.exec(data)
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
    autoImportComponents,
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
