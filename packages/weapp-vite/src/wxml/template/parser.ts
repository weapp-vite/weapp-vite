import type { Syntax, TemplateParser } from '@weapp-vite/wxml/core'
import type { MpPlatform } from '../../types'
import { findScriptClosingTag } from '@weapp-vite/language-service'
import { compileDialect, createParser } from '@weapp-vite/wxml/core'
import { getTemplatePreset } from '@weapp-vite/wxml/presets'

const platformParsers = new Map<MpPlatform, Map<Syntax, TemplateParser>>()
const outputParsers = new Map<MpPlatform, Map<Syntax, TemplateParser>>()
const tagParsers = new WeakMap<ReadonlySet<string>, { rawTags: readonly string[], bySyntax: Map<Syntax, TemplateParser> }>()

/** 构建输入保留可移植标签兼容集合，方言由真实输入阶段显式选择。 */
export function platformTemplateParser(platform: MpPlatform, syntax: Syntax): TemplateParser {
  let bySyntax = platformParsers.get(platform)
  if (!bySyntax) {
    bySyntax = new Map()
    platformParsers.set(platform, bySyntax)
  }
  let parser = bySyntax.get(syntax)
  if (!parser) {
    const definition = getTemplatePreset(platform).compatibilityDialect
    parser = createParser(compileDialect({ ...definition, id: `build:${platform}:${syntax}`, syntax }), { resolveScriptBoundary: findScriptClosingTag })
    bySyntax.set(syntax, parser)
  }
  return parser
}

/** 最终产物只识别目标平台的原文脚本标签，保留普通同名组件的模板语义。 */
export function outputTemplateParser(platform: MpPlatform, syntax: Syntax): TemplateParser {
  let bySyntax = outputParsers.get(platform)
  if (!bySyntax) {
    bySyntax = new Map()
    outputParsers.set(platform, bySyntax)
  }
  let parser = bySyntax.get(syntax)
  if (!parser) {
    const definition = getTemplatePreset(platform).dialect
    parser = createParser(compileDialect({ ...definition, id: `build-output:${platform}:${syntax}`, syntax }), { resolveScriptBoundary: findScriptClosingTag })
    bySyntax.set(syntax, parser)
  }
  return parser
}

/** 编辑与验证视图复用调用方已选定的脚本集合，不从构建目标猜输入语法。 */
export function configuredTemplateParser(scriptTags: ReadonlySet<string>, syntax: Syntax): TemplateParser {
  const rawTags = [...scriptTags]
  let cached = tagParsers.get(scriptTags)
  if (!cached || cached.rawTags.length !== rawTags.length || cached.rawTags.some((tag, index) => tag !== rawTags[index])) {
    cached = { rawTags, bySyntax: new Map() }
    tagParsers.set(scriptTags, cached)
  }
  let parser = cached.bySyntax.get(syntax)
  if (!parser) {
    parser = createParser(compileDialect({ id: `build-output:${syntax}`, syntax, rawTags }), { resolveScriptBoundary: findScriptClosingTag })
    cached.bySyntax.set(syntax, parser)
  }
  return parser
}
