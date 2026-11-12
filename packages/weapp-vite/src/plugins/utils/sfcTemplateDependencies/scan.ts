import type { MpPlatform, WxmlDep } from '../../../types'
import { getScriptModuleImportAttrs } from '../../../utils/wxmlScriptModule'
import { decodeBuildAttribute } from '../../../wxml/scan/tokenViews'
import { getTemplateImportAttrs } from '../../../wxml/shared'
import { platformTemplateParser } from '../../../wxml/template/parser'

/** Vue 负责源码结构校验；这里只读取原生依赖声明，不把 HTML void 元素按 XML 配对。 */
export function scanSfcTemplateDependencies(source: string, platform: MpPlatform = 'weapp'): WxmlDep[] {
  const deps: WxmlDep[] = []
  for (const token of platformTemplateParser(platform, 'xml').scan(source).tokens) {
    if (token.kind !== 'tag' || token.closing) {
      continue
    }
    const imports = getScriptModuleImportAttrs(token.name, platform) ?? getTemplateImportAttrs(token.name)
    if (!imports) {
      continue
    }
    const attrs = Object.fromEntries(token.attributes.map(attribute => [attribute.name, decodeBuildAttribute(attribute)]))
    for (const attribute of token.attributes) {
      if (imports.includes(attribute.name)) {
        deps.push({
          tagName: token.name,
          name: attribute.name,
          value: decodeBuildAttribute(attribute),
          quote: attribute.quote ?? (attribute.value === undefined ? undefined : null),
          start: attribute.start,
          end: attribute.end,
          attrs,
        })
      }
    }
  }
  return deps
}
