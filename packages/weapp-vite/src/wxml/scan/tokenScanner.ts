import type { TagToken } from '@weapp-vite/wxml/core'
import type { ComponentsMap, MpPlatform, WxmlDep } from '../../types'
import type { WxmlToken } from './types'
import { getSupportedMiniProgramDirectivePrefixes } from '@weapp-core/shared'
import { getWxmlPlatformTransformOptions } from '../../platform'
import { getNativeScriptModuleByTag, getScriptModuleImportAttrs, getScriptModuleTagNames, isScriptModuleImportAttr } from '../../utils/wxmlScriptModule'
import { getTemplateImportAttrs, isTemplateImportAttr, shouldNormalizeTemplateImportSource } from '../shared'
import { platformTemplateParser } from '../template/parser'
import { resolveEventDirectiveName } from './events'
import { decodeBuildAttribute, textTokens } from './tokenViews'

const supportedPrefixes = new Set(getSupportedMiniProgramDirectivePrefixes())
const scriptLanguages = new Set(['js', 'ts'])
const scriptExtension = /\.(?:wxs|sjs)(?:\.[jt]s)?$|\.filter\.[jt]s$/i
const directiveName = /^([a-z]+):(if|elif|else|for|for-item|for-index|key)$/
const legacyDirective = /^wx-(if|for)$/

function kebabCase(name: string) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2').toLowerCase()
}

interface ScanOptions {
  source: string
  platform: MpPlatform
  excludeComponent: (name: string) => boolean
}

/** 基于共享词法结果分析构建语义，不重新解释模板结构或脚本正文。 */
export function parseWxmlTokens({ source, platform, excludeComponent }: ScanOptions): { token: WxmlToken } {
  const { directivePrefix, normalizeComponentTagName } = getWxmlPlatformTransformOptions(platform)
  const scriptTags = new Set(getScriptModuleTagNames(platform))
  // 此消费入口也处理 SFC 生成的 XML，目标平台不决定源码转义层。
  let scanned = platformTemplateParser(platform, 'xml').scan(source)
  if (scanned.diagnostics.some(item => item.severity === 'error') && /\\["']/.test(source)) {
    // 仅为旧转义输入保留 GE004 诊断；合法 XML 始终使用第一次扫描的范围。
    const legacy = platformTemplateParser(platform, 'legacy').scan(source)
    if (!legacy.diagnostics.some(item => item.severity === 'error')) {
      scanned = legacy
    }
  }
  const fatal = scanned.diagnostics.find(item => item.severity === 'error')
  if (fatal) {
    throw new Error(`[weapp.wxml] ${fatal.start}: ${fatal.message}`)
  }
  const components: ComponentsMap = Object.create(null)
  const autoImportComponents: ComponentsMap = Object.create(null)
  const deps: WxmlDep[] = []
  const token: WxmlToken = {
    components,
    autoImportComponents,
    deps,
    removalRanges: [],
    commentTokens: [],
    inlineWxsTokens: [],
    scriptModules: [],
    templateTokens: [],
    wxsImportNormalizeTokens: [],
    removeWxsLangAttrTokens: [],
    templateImportNormalizeTokens: [],
    scriptModuleTagTokens: [],
    eventTokens: [],
    directiveTokens: [],
    tagNameTokens: [],
    glassEaselFindings: [],
    code: source,
  }
  const attributes = new Map<TagToken, Record<string, string>>()
  const conditionalStack: number[] = []
  const loops = new Set<number>()
  let loopDepth = 0
  let scriptTag: TagToken | undefined
  let legacyRangeStart = 0

  // 兼容旧索引的关闭事件顺序及起点；基础 tokens 始终提供精确的配对范围。
  const registerComponent = (opening: TagToken, end: number) => {
    const componentName = normalizeComponentTagName ? kebabCase(opening.name) : opening.name
    const range = { start: legacyRangeStart, end }
    ;(autoImportComponents[componentName] ??= []).push(range)
    if (!excludeComponent(opening.name)) {
      ;(components[componentName] ??= []).push(range)
    }
    legacyRangeStart = 0
  }

  for (const [index, item] of scanned.tokens.entries()) {
    if (item.kind === 'comment') {
      const data = source.slice(item.start + 4, item.end - 3)
      const conditional = /#ifdef\s+(\w+)/.exec(data)
      if (conditional && conditional[1] !== platform) {
        conditionalStack.push(item.start)
      }
      if (/#endif/.test(data)) {
        const start = conditionalStack.pop()
        if (start !== undefined) {
          token.removalRanges.push({ start, end: item.end })
        }
      }
      token.commentTokens.push({ start: item.start, end: item.end, value: '' })
      continue
    }
    if (item.kind === 'script') {
      if (item.end > item.start && scriptTag && scriptLanguages.has(attributes.get(scriptTag)?.lang ?? '')) {
        token.inlineWxsTokens.push({ start: item.start, end: item.end, value: source.slice(item.start, item.end), ...(scriptTag.name === 'filter' ? { tagName: 'filter' } : {}) })
      }
      continue
    }
    if (item.kind === 'text') {
      const previous = scanned.tokens[index - 1]
      const start = previous?.kind === 'tag' && previous.closing ? Math.min(previous.end, previous.nameEnd + 1) : item.start
      token.templateTokens!.push(...textTokens(source, start, item.start, item.end))
      continue
    }
    if (item.kind === 'cdata') {
      token.templateTokens!.push({ start: item.start, end: item.end, value: source.slice(item.start + 9, item.end - 3) })
      continue
    }
    if (item.kind !== 'tag') {
      continue
    }
    const name = item.name
    if (item.closing) {
      const opening = item.matching === undefined ? undefined : scanned.tokens[item.matching]
      if (opening?.kind === 'tag') {
        registerComponent(opening, Math.min(item.end, item.nameEnd + 1))
      }
      if (item.matching !== undefined && loops.delete(item.matching)) {
        loopDepth--
      }
      if (scriptTags.has(name)) {
        scriptTag = undefined
        if (name !== 'filter' && !getNativeScriptModuleByTag(name, platform)) {
          token.scriptModuleTagTokens.push({ start: item.nameStart, end: item.nameEnd, value: name })
        }
      }
      if (normalizeComponentTagName && /[A-Z]/.test(name)) {
        token.tagNameTokens!.push({ start: item.nameStart, end: item.nameEnd, value: kebabCase(name) })
      }
      continue
    }
    legacyRangeStart = item.start
    const componentName = normalizeComponentTagName ? kebabCase(name) : name
    if (item.selfClosing) {
      registerComponent(item, item.end)
    }
    if (normalizeComponentTagName && componentName !== name) {
      token.tagNameTokens!.push({ start: item.nameStart, end: item.nameEnd, value: componentName })
    }
    const script = scriptTags.has(name)
    const nativeScript = getNativeScriptModuleByTag(name, platform)
    const attrs: Record<string, string> = Object.create(null)
    const dependencyAttrs: Record<string, string> = Object.create(null)
    attributes.set(item, dependencyAttrs)
    for (const attribute of item.attributes) {
      const value = decodeBuildAttribute(attribute)
      if (!Object.hasOwn(attrs, attribute.name)) {
        attrs[attribute.name] = value
      }
      dependencyAttrs[attribute.name] = value
    }
    const importAttrs = getScriptModuleImportAttrs(name, platform) ?? getTemplateImportAttrs(name)
    const nativeSource = nativeScript ? dependencyAttrs[nativeScript.sourceAttribute]?.toLowerCase() ?? '' : ''
    if (nativeScript && (Object.hasOwn(dependencyAttrs, 'lang') || (nativeSource && !nativeSource.endsWith(`.${nativeScript.extension}`)))) {
      throw new Error(`[weapp.wxml] ${item.start}: <${name}> only supports native .${nativeScript.extension} scripts without lang; use the portable script module tag for compiled scripts.`)
    }
    if (script) {
      scriptTag = item.selfClosing ? undefined : item
      token.scriptModules!.push({ attrs, tagName: name })
      if (name !== 'filter' && !nativeScript) {
        token.scriptModuleTagTokens.push({ start: item.nameStart, end: item.nameEnd, value: name })
      }
    }
    if (name === 'include' && loopDepth > 0) {
      token.glassEaselFindings!.push({ code: 'GE003', severity: 'error', message: 'wx:for 作用域内的 <include> 无法向 glass-easel 传递循环变量，请改用 <template>。', start: item.start })
    }
    const hasLoop = item.attributes.some(attribute => ['wx:for', 'wx-for', 'let:for'].includes(attribute.name))
    if (hasLoop && !item.selfClosing) {
      loops.add(index)
      loopDepth++
    }
    for (const attribute of item.attributes) {
      const attrName = attribute.name
      const value = decodeBuildAttribute(attribute)
      const start = attribute.start
      const end = attribute.end
      const nameRange = { start, end: attribute.nameEnd }
      const legacy = legacyDirective.exec(attrName)
      if (legacy) {
        token.directiveTokens!.push({ ...nameRange, value: `${directivePrefix}:${legacy[1]}` })
        token.glassEaselFindings!.push({ code: 'GE002', severity: 'warning', message: `${attrName} 不受 glass-easel 支持，已安全归一化为 ${directivePrefix}:${legacy[1]}。`, start, normalized: true })
      }
      if (/\\["']/.test(source.slice(start, end))) {
        token.glassEaselFindings!.push({ code: 'GE004', severity: 'error', message: '属性仍使用反斜杠转义引号，请改用 &quot;、&apos; 或调整属性外层引号。', start })
      }
      if (!script) {
        token.templateTokens!.push({ start, end: end + 1, value })
      }
      if (importAttrs?.includes(attrName)) {
        deps.push({ name: attrName, value, quote: attribute.quote ?? (attribute.value === undefined ? undefined : null), tagName: name, start, end, attrs: dependencyAttrs })
        if (isTemplateImportAttr(name, attrName) && shouldNormalizeTemplateImportSource(value)) {
          token.templateImportNormalizeTokens.push({ start: attribute.valueStart!, end: attribute.valueEnd!, value })
        }
      }
      const event = resolveEventDirectiveName(attrName, platform)
      if (event && event !== attrName) {
        token.eventTokens.push({ ...nameRange, value: event })
      }
      const directive = directiveName.exec(attrName)
      if (directive && directive[1] !== directivePrefix && supportedPrefixes.has(directive[1])) {
        token.directiveTokens!.push({ ...nameRange, value: `${directivePrefix}:${directive[2]}` })
      }
      if (script && !nativeScript && attrName === 'lang' && scriptLanguages.has(value)) {
        token.removeWxsLangAttrTokens.push({ start, end, value })
      }
      const scriptSource = attrs[attrName]
      if (script && !nativeScript && isScriptModuleImportAttr(name, attrName, platform) && scriptSource && (scriptExtension.test(scriptSource) || scriptLanguages.has(attrs.lang))) {
        token.wxsImportNormalizeTokens.push({ start: attribute.valueStart!, end: attribute.valueEnd!, value: scriptSource, ...(name === 'filter' ? { tagName: 'filter' } : {}) })
      }
    }
  }
  token.removalRanges.sort((left, right) => right.start - left.start)
  return { token }
}
