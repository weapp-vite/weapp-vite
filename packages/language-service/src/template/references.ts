import type { LanguageProfile } from '../profiles'
import type { TemplateAttribute, TemplateReference, TemplateScope, TemplateScript, TemplateTag, TemplateToken } from './types'
import { isEventAttribute } from '../profiles'

function valueRange(attribute: TemplateAttribute) {
  return { start: attribute.valueStart ?? attribute.start, end: attribute.valueEnd ?? attribute.end }
}

function expressionRange(attribute: TemplateAttribute) {
  const value = attribute.value ?? ''
  const wrapped = /^\s*\{\{([\s\S]*)\}\}\s*$/.exec(value)
  if (!wrapped) {
    return { ...valueRange(attribute), source: value }
  }
  const innerStart = value.indexOf('{{') + 2
  const leading = /^\s*/.exec(wrapped[1])?.[0].length ?? 0
  const source = wrapped[1].trim()
  const start = (attribute.valueStart ?? attribute.start) + innerStart + leading
  return { start, end: start + source.length, source }
}

function loopScope(tag: TemplateTag, tokens: TemplateToken[], profile: LanguageProfile): TemplateScope | undefined {
  const directives = profile.directives
  const loop = tag.attributes.find(attribute => attribute.name === directives.for)
  if (!loop?.value) {
    return undefined
  }
  let collection = expressionRange(loop)
  const inlineLoop = profile.platform === 'swan' ? /^\s*([^\s,]+)(?:\s*,\s*([^\s,]+))?\s+in\s+/.exec(loop.value) : null
  if (inlineLoop) {
    const collectionOffset = inlineLoop[0].length
    const inlineCollection = loop.value.slice(collectionOffset)
    const start = (loop.valueStart ?? loop.start) + collectionOffset
    collection = { start, end: start + inlineCollection.length, source: inlineCollection }
  }
  const binding = (kind: 'item' | 'index', name: string, attributeName: string, inlineName?: string) => {
    const attribute = tag.attributes.find(attribute => attribute.name === attributeName)
    const explicit = attribute?.value?.trim()
    const bindingName = explicit || inlineName || name
    const start = explicit ? attribute!.valueStart! : inlineName ? (loop.valueStart ?? loop.start) + loop.value!.indexOf(inlineName) : loop.valueStart ?? loop.start
    return { name: bindingName, kind, start, end: explicit || inlineName ? start + bindingName.length : start, collection }
  }
  return {
    start: tag.start,
    end: tag.matching === undefined ? tag.end : tokens[tag.matching].end,
    bindings: [binding('item', 'item', directives.forItem, inlineLoop?.[1]), binding('index', 'index', directives.forIndex, inlineLoop?.[2])],
  }
}

/** 提取引用和循环范围，保留源码位置以供编辑器直接映射。 */
export function collectTemplateMetadata(source: string, tokens: TemplateToken[], profile?: LanguageProfile) {
  const references: TemplateReference[] = []
  const scopes: TemplateScope[] = []
  const scripts: TemplateScript[] = []
  for (const [index, token] of tokens.entries()) {
    if (token.kind !== 'tag' || token.closing) {
      continue
    }
    const tag = token.name.toLowerCase()
    const attribute = (name: string) => token.attributes.find(attribute => attribute.name === name)
    const reference = (kind: TemplateReference['kind'], value: TemplateAttribute | undefined) => {
      if (value?.value !== undefined) {
        references.push({ kind, name: value.value, ...(['template-import', 'template-include', 'script-import'].includes(kind) ? { source: value.value } : {}), ...valueRange(value) })
      }
    }
    if (tag === 'import' || tag === 'include') {
      reference(tag === 'import' ? 'template-import' : 'template-include', attribute('src'))
    }
    if (tag === 'template') {
      reference('template-name', attribute('name'))
      reference('template-use', attribute('is'))
    }
    if (['wxs', 'sjs', 'ks', 'filter', 'import-sjs', 'script'].includes(tag)) {
      const alipayImport = tag === 'import-sjs' && profile?.platform === 'alipay'
      const module = attribute(alipayImport ? 'name' : 'module')
      reference('script-module', module)
      const referenceCount = references.length
      const sourceFile = attribute(alipayImport ? 'from' : 'src')
      reference('script-import', sourceFile)
      const lang = attribute('lang')?.value
      const typedFile = /\.tsx?$/.test(sourceFile?.value ?? '')
      const compiledFile = typedFile || /\.(?:wxs|sjs|ks)\.js$/.test(sourceFile?.value ?? '')
      const sourceKind = /^(?:ts|typescript|js|javascript)$/.test(lang ?? '') || compiledFile ? 'compiled' as const : 'native' as const
      const language = /^(?:ts|typescript)$/.test(lang ?? '') || (!lang && typedFile) ? 'typescript' as const : 'javascript' as const
      if (references.length > referenceCount) {
        Object.assign(references[references.length - 1], { tagName: tag, sourceKind, language })
      }
      const body = tokens[index + 1]
      if (body?.kind === 'script') {
        scripts.push({ tagName: tag, start: body.start, end: body.end, source: source.slice(body.start, body.end), sourceKind, language, moduleName: module?.value })
      }
    }
    if (profile) {
      const scope = loopScope(token, tokens, profile)
      if (scope) {
        scopes.push(scope)
      }
      for (const attr of token.attributes) {
        if (isEventAttribute(attr.name, profile)) {
          reference('event', attr)
        }
      }
    }
  }
  return { references, scopes, scripts }
}
