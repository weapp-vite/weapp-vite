import type { DocumentContext, DocumentFields } from './documentContext'
import type { CompiledDialect, Document, ParseOptions, Platform, Syntax } from './types'
import { compileDialect, compiledState } from './dialect'
import { presets } from './presets'

interface CompatibilityContext extends DocumentContext {
  readonly metadata: { readonly platform: Platform, readonly options: ParseOptions }
  readonly createDocument: (source: string, fields: DocumentFields) => Document
}

interface CompatibilityPreset {
  readonly syntax: Syntax
  readonly legacy: CompiledDialect
  readonly xml: CompiledDialect
  readonly contexts: Readonly<Record<Syntax, CompatibilityContext>>
}

const compiled = new Map<Platform, CompatibilityPreset>()
const customDialects = new WeakMap<readonly string[], Map<CompiledDialect, CompiledDialect>>()
const customContexts = new WeakMap<CompiledDialect, CompatibilityContext>()
const resolvedContexts = new WeakMap<NonNullable<ParseOptions['resolveScriptBoundary']>, WeakMap<CompiledDialect, CompatibilityContext>>()

function createContext(platform: Platform, syntax: Syntax, dialect: CompiledDialect, explicitRawTags = false, resolver?: ParseOptions['resolveScriptBoundary']): CompatibilityContext {
  const snapshot: ParseOptions = Object.freeze({ platform, syntax, rawTags: explicitRawTags ? dialect.rawTags : undefined, resolveScriptBoundary: resolver })
  return Object.freeze({
    dialect,
    state: compiledState(dialect),
    resolveScriptBoundary: resolver,
    metadata: Object.freeze({ platform, options: snapshot }),
    createDocument: (source: string, fields: DocumentFields): Document => ({ source, platform, syntax: fields.syntax, tokens: fields.tokens, diagnostics: fields.diagnostics, children: fields.children, options: snapshot }),
  })
}

for (const preset of presets) {
  const legacy = compileDialect({ ...preset.compatibilityDialect, syntax: 'legacy' })
  const xml = compileDialect({ ...preset.compatibilityDialect, syntax: 'xml' })
  compiled.set(preset.id, {
    syntax: preset.compatibilityDialect.syntax,
    legacy,
    xml,
    contexts: Object.freeze({ legacy: createContext(preset.id, 'legacy', legacy), xml: createContext(preset.id, 'xml', xml) }),
  })
}

function readResolver(options: ParseOptions) {
  const resolver = options.resolveScriptBoundary
  if (resolver !== undefined && typeof resolver !== 'function') {
    throw new TypeError('Expected resolveScriptBoundary to be a function.')
  }
  return resolver
}

function cachedContext(platform: Platform, syntax: Syntax, dialect: CompiledDialect, explicitRawTags: boolean, resolver?: ParseOptions['resolveScriptBoundary']): CompatibilityContext {
  let contexts = customContexts
  if (resolver) {
    const existing = resolvedContexts.get(resolver)
    if (existing) {
      contexts = existing
    }
    else {
      contexts = new WeakMap()
      resolvedContexts.set(resolver, contexts)
    }
  }
  const previous = contexts.get(dialect)
  if (previous) {
    return previous
  }
  const context = createContext(platform, syntax, dialect, explicitRawTags, resolver)
  contexts.set(dialect, context)
  return context
}

/** 自定义数组保持内容观测，校验与快照比较共用一轮遍历。 */
function customContext(options: ParseOptions, platform: Platform, syntax: Syntax, base: CompiledDialect, rawTags: readonly string[]): CompatibilityContext {
  if (!Array.isArray(rawTags)) {
    throw new TypeError('Expected rawTags to be an array of nonempty names.')
  }
  let variants = customDialects.get(rawTags)
  const previous = variants?.get(base)
  let unchanged = previous !== undefined && previous.rawTags.length === rawTags.length
  for (let index = 0; index < rawTags.length; index++) {
    const name = rawTags[index]
    if (typeof name !== 'string' || !name) {
      throw new TypeError('Expected rawTags to be an array of nonempty names.')
    }
    if (unchanged && name !== previous!.rawTags[index]) {
      unchanged = false
    }
  }
  const resolver = readResolver(options)
  const dialect = unchanged ? previous! : compileDialect({ id: `${platform}-custom`, syntax, rawTags })
  if (!unchanged) {
    if (!variants) {
      variants = new Map()
      customDialects.set(rawTags, variants)
    }
    variants.set(base, dialect)
  }
  return cachedContext(platform, syntax, dialect, true, resolver)
}

/** 默认配置直接选取预编译上下文，自定义与 resolver 路径独立维护弱缓存。 */
export function normalizeOptions(options: ParseOptions): CompatibilityContext {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Expected a parse options object.')
  }
  const platform = options.platform ?? 'weapp'
  const preset = compiled.get(platform)
  if (!preset) {
    throw new TypeError(`Unsupported template platform: ${String(platform)}.`)
  }
  const syntax = options.syntax ?? preset.syntax
  if (syntax !== 'legacy' && syntax !== 'xml') {
    throw new TypeError(`Unsupported template syntax: ${String(syntax)}.`)
  }
  const rawTags = options.rawTags
  if (rawTags !== undefined) {
    return customContext(options, platform, syntax, preset[syntax], rawTags)
  }
  const resolver = readResolver(options)
  return resolver ? cachedContext(platform, syntax, preset[syntax], false, resolver) : preset.contexts[syntax]
}

/** 扫描、解析和兼容文档恢复共用不可变快照；缓存不捕获源码或保活用户 resolver。 */
export const compatibilityContext = normalizeOptions
