import type { CompiledDialect, DialectDefinition, Document, Node, ParseOptions, TemplateDocument, TemplateParser } from '../../../packages/wxml/src/types'
import type { TemplateApi } from '../assertions'

export interface CoreTemplateModule {
  decodeAttribute: TemplateApi['decodeAttribute']
  compileDialect: (definition: DialectDefinition) => CompiledDialect
  createParser: (dialect: CompiledDialect, options?: Pick<ParseOptions, 'resolveScriptBoundary'>) => TemplateParser
  serialize: (document: TemplateDocument, options?: Parameters<TemplateApi['serialize']>[1]) => string
  walk: (document: TemplateDocument | readonly Node[], visitor: Parameters<TemplateApi['walk']>[1]) => void
  edit: (document: TemplateDocument, visitor: Parameters<TemplateApi['edit']>[1]) => TemplateDocument
}

/** 核心适配器只补测试消费视图，不改 AST，不从根入口加载平台配置。 */
export function createCoreTemplateApi(core: CoreTemplateModule): TemplateApi {
  const parsers = new Map<string, TemplateParser>()
  const resolverIds = new WeakMap<NonNullable<ParseOptions['resolveScriptBoundary']>, number>()
  const documents = new WeakMap<Document, TemplateDocument>()
  let nextResolverId = 0

  function resolverKey(resolver: ParseOptions['resolveScriptBoundary']) {
    if (!resolver) {
      return ''
    }
    let id = resolverIds.get(resolver)
    if (id === undefined) {
      id = ++nextResolverId
      resolverIds.set(resolver, id)
    }
    return `resolver:${id}`
  }

  function parserFor(options: ParseOptions = {}): TemplateParser {
    const syntax = options.syntax ?? 'legacy'
    const rawTags = options.rawTags ?? []
    const key = JSON.stringify([syntax, rawTags, resolverKey(options.resolveScriptBoundary)])
    let parser = parsers.get(key)
    if (!parser) {
      const dialect = core.compileDialect({ id: `corpus:${key}`, syntax, rawTags })
      parser = core.createParser(dialect, options.resolveScriptBoundary ? { resolveScriptBoundary: options.resolveScriptBoundary } : {})
      parsers.set(key, parser)
    }
    return parser
  }

  function view(template: TemplateDocument, options: ParseOptions): Document {
    const snapshot = Object.freeze({ ...options, syntax: template.syntax, rawTags: Object.freeze([...(options.rawTags ?? [])]) })
    const document: Document = {
      get source() { return template.source },
      get syntax() { return template.syntax },
      get tokens() { return template.tokens },
      get diagnostics() { return template.diagnostics },
      get children() { return template.children },
      platform: options.platform ?? 'weapp',
      options: snapshot,
    }
    documents.set(document, template)
    return document
  }

  function original(document: Document): TemplateDocument {
    const template = documents.get(document)
    if (!template) {
      throw new TypeError('Expected a document produced by this core acceptance adapter.')
    }
    return template
  }

  return {
    scan: (source, options) => parserFor(options).scan(source),
    parse: (source, options = {}) => view(parserFor(options).parse(source), options),
    serialize: (document, options) => core.serialize(original(document), options),
    walk: (document, visitor) => core.walk(Array.isArray(document) ? document : original(document as Document), visitor),
    edit: (document, visitor) => view(core.edit(original(document), visitor), document.options),
    decodeAttribute: core.decodeAttribute,
  }
}
