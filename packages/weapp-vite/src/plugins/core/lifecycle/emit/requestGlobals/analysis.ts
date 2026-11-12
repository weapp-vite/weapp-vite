import type { RequestGlobalsUsageAnalysis } from '../../../../../runtime/config/internal/injectRequestGlobals'
import type { HmrProfileOperationKey } from '../../../../../utils/hmrProfile'
import { createRequestGlobalsUsageCollector, FULL_REQUEST_GLOBAL_TARGETS } from '../../../../../runtime/config/internal/injectRequestGlobals'
import { parseJsLike, traverse } from '../../../../../utils/babel'
import { recordHmrProfileOperation } from '../../../../../utils/hmrProfile'
import { getStaticStringLiteral } from '../rewrite/literals'
import { createTopLevelCallCollector } from './bindings'
import { createRequestGlobalsInstallerCollector } from './installer'

interface StaticImportFact {
  source: string
}

export interface RequestGlobalsContentFacts {
  readonly installerName: string | null
  readonly exports: readonly (readonly [string, string])[]
  readonly declaredIdentifiers: readonly string[]
  readonly staticImports: readonly StaticImportFact[]
  readonly requires: readonly string[]
  readonly topLevelCalls: readonly { name: string, start: number, end: number, binding?: string }[]
  readonly usage: RequestGlobalsUsageAnalysis | undefined
}

export interface RequestGlobalsAnalysisOptions {
  cache: RequestGlobalsAnalysisCache
  astEngine?: 'babel' | 'oxc'
  profile?: Partial<Record<HmrProfileOperationKey, number | undefined>>
}

type Visitor = Record<string, (path: any) => void>

function mergeVisitors(...visitors: Visitor[]): Visitor {
  const merged: Visitor = {}
  for (const key of new Set(visitors.flatMap(visitor => Object.keys(visitor)))) {
    merged[key] = (path) => {
      for (const visitor of visitors) {
        visitor[key]?.(path)
      }
    }
  }
  return merged
}

/** 一次解析和作用域遍历聚合请求全局安装所需的纯内容事实。 */
function analyzeContent(code: string): RequestGlobalsContentFacts {
  const installer = createRequestGlobalsInstallerCollector()
  const calls = createTopLevelCallCollector()
  const usage = createRequestGlobalsUsageCollector(code, FULL_REQUEST_GLOBAL_TARGETS, true)
  const declaredIdentifiers: string[] = []
  const exports: Array<readonly [string, string]> = []
  const staticImports: StaticImportFact[] = []
  const requires: string[] = []
  const visitor: Visitor = {
    Program(program) {
      declaredIdentifiers.push(...Object.keys(program.scope.bindings))
    },
    ImportDeclaration(path) {
      const source = getStaticStringLiteral(path.node.source)
      if (source) {
        staticImports.push(Object.freeze({ source }))
      }
    },
    CallExpression(path) {
      const node = path.node
      if (node.callee?.type === 'Identifier' && node.callee.name === 'require' && !path.scope.hasBinding('require')) {
        const source = getStaticStringLiteral(node.arguments?.[0])
        if (source) {
          requires.push(source)
        }
      }
      const callee = node.callee
      if (callee?.type !== 'MemberExpression' || callee.object?.name !== 'Object' || callee.property?.name !== 'defineProperty') {
        return
      }
      const [owner, key, descriptor] = node.arguments
      if (owner?.type !== 'Identifier' || owner.name !== 'exports' || descriptor?.type !== 'ObjectExpression') {
        return
      }
      const exportName = getStaticStringLiteral(key)
      if (!exportName) {
        return
      }
      const getter = descriptor.properties.find((property: any) => {
        return (property.type === 'ObjectProperty' || property.type === 'ObjectMethod') && property.key?.type === 'Identifier' && property.key.name === 'get'
      })
      const value = getter?.type === 'ObjectMethod' ? getter : getter?.value
      const body = value?.body
      const returned = body?.type === 'BlockStatement' ? body.body.find((statement: any) => statement.type === 'ReturnStatement')?.argument : body
      if (returned?.type === 'Identifier') {
        exports.push(Object.freeze([returned.name, exportName] as const))
      }
    },
  }
  traverse(parseJsLike(code) as any, mergeVisitors(installer.visitor, calls.visitor, usage.source === code ? usage.visitor : {}, visitor))
  const usageFacts = usage.source === code ? usage.analysis() : undefined
  return Object.freeze({
    installerName: installer.installerName(),
    exports: Object.freeze(exports),
    declaredIdentifiers: Object.freeze(declaredIdentifiers),
    staticImports: Object.freeze(staticImports),
    requires: Object.freeze(requires),
    topLevelCalls: Object.freeze(calls.calls),
    usage: usageFacts && Object.freeze({
      ...usageFacts,
      importedTargets: Object.freeze(usageFacts.importedTargets),
      referencedTargets: Object.freeze(usageFacts.referencedTargets),
      referencedIdentifiers: usageFacts.referencedIdentifiers && Object.freeze(usageFacts.referencedIdentifiers),
    }),
  })
}

interface AnalysisStorage {
  entries: Map<string, RequestGlobalsContentFacts>
  codeBytes: number
}

/** 有界会话缓存仅持有字节和不可变事实，不持有 AST、chunk 或构建上下文。 */
export class RequestGlobalsAnalysisCache {
  constructor(
    private readonly maxEntries = 256,
    private readonly maxCodeBytes = 8 * 1024 * 1024,
    private readonly storage: AnalysisStorage = { entries: new Map(), codeBytes: 0 },
    private readonly scope = '',
  ) {}

  /** 配置间只隔离键空间，共享同一会话的总容量上限。 */
  forScope(scope: number) {
    return new RequestGlobalsAnalysisCache(this.maxEntries, this.maxCodeBytes, this.storage, String(scope))
  }

  get(code: string, filename: string, options: Omit<RequestGlobalsAnalysisOptions, 'cache'> = {}) {
    const key = `${this.scope}\0${options.astEngine ?? 'babel'}\0${filename}\0${code}`
    const { entries } = this.storage
    const cached = entries.get(key)
    if (cached) {
      entries.delete(key)
      entries.set(key, cached)
      recordHmrProfileOperation(options.profile, 'rewriteAnalysisCacheHitCount')
      return cached
    }
    recordHmrProfileOperation(options.profile, 'rewriteAnalysisCacheMissCount')
    let facts: RequestGlobalsContentFacts
    try {
      facts = analyzeContent(code)
    }
    catch {
      // 聚合解析不适用时仍由原消费者执行各自的解析、回退和错误处理。
      return undefined
    }
    const bytes = key.length * 2
    if (this.maxEntries <= 0 || bytes > this.maxCodeBytes) {
      return facts
    }
    entries.set(key, facts)
    this.storage.codeBytes += bytes
    while (entries.size > this.maxEntries || this.storage.codeBytes > this.maxCodeBytes) {
      const oldest = entries.keys().next().value
      if (oldest === undefined) {
        break
      }
      entries.delete(oldest)
      this.storage.codeBytes -= oldest.length * 2
    }
    return facts
  }
}

const sessionCaches = new WeakMap<object, {
  cache: RequestGlobalsAnalysisCache
  configs: WeakMap<object, Map<string, RequestGlobalsAnalysisCache>>
  nextScope: number
}>()

interface RequestGlobalsAnalysisScope {
  options?: { sourceConfig?: object }
  cwd?: string
  absoluteSrcRoot?: string
  platform?: string
  isDev?: boolean
}

/** 独立快照复用源配置身份，每配置只保留八个根范围，全部范围共用会话容量。 */
export function getSessionRequestGlobalsAnalysisCache(session: object, config: RequestGlobalsAnalysisScope) {
  let owner = sessionCaches.get(session)
  if (!owner) {
    owner = { cache: new RequestGlobalsAnalysisCache(), configs: new WeakMap(), nextScope: 0 }
    sessionCaches.set(session, owner)
  }
  const identity = config.options?.sourceConfig ?? config
  let roots = owner.configs.get(identity)
  if (!roots) {
    roots = new Map()
    owner.configs.set(identity, roots)
  }
  const key = JSON.stringify([config.cwd, config.absoluteSrcRoot, config.platform, config.isDev])
  let cache = roots.get(key)
  roots.delete(key)
  if (!cache) {
    cache = owner.cache.forScope(++owner.nextScope)
  }
  roots.set(key, cache)
  if (roots.size > 8) {
    roots.delete(roots.keys().next().value!)
  }
  return cache
}

export function getRequestGlobalsContentFacts(code: string, filename: string, options?: RequestGlobalsAnalysisOptions) {
  return options?.cache.get(code, filename, options)
}
