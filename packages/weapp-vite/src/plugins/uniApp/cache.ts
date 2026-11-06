import type { ConfigService } from '../../context'
import { LRUCache } from 'lru-cache'

type CompatibilityConfig = Pick<ConfigService, 'absoluteSrcRoot' | 'platform' | 'weappViteConfig'>
  & Partial<Pick<ConfigService, 'options'>>

/** 只缓存纯转换字符串；所有项目和平台范围共用容量，不持有 AST 或钩子。 */
export class UniAppCompatibilityCache {
  private readonly entries: LRUCache<string, string>
  private hits = 0
  private misses = 0

  constructor(maxEntries = 2048, maxBytes = 32 * 1024 * 1024) {
    this.entries = new LRUCache({
      max: maxEntries,
      maxSize: maxBytes,
      sizeCalculation: (value, key) => Math.max(1, (key.length + value.length) * 2),
    })
  }

  transform(scope: string, source: string, transform: () => string): string {
    const key = `${scope}\0${source}`
    const cached = this.entries.get(key)
    if (cached !== undefined) {
      this.hits += 1
      return cached
    }
    this.misses += 1
    // 转换抛错时不写入缓存，后续读取保留原有错误及重试语义。
    const result = transform()
    this.entries.set(key, result)
    return result
  }

  get stats() {
    return { hits: this.hits, misses: this.misses, entries: this.entries.size, bytes: this.entries.calculatedSize }
  }

  clear() {
    this.entries.clear()
    this.hits = this.misses = 0
  }
}

interface SessionCache {
  cache: UniAppCompatibilityCache
  identities: WeakMap<object, number>
  nextIdentity: number
}

const sessions = new WeakMap<object, SessionCache>()
const bindings = new WeakMap<object, { session: object }>()

/** snapshot 只借用会话缓存；释放旧代绑定不会撤销新代或其他项目的绑定。 */
export function bindUniAppCompatibilitySession(config: object, session: object): () => void {
  const binding = { session }
  bindings.set(config, binding)
  return () => {
    if (bindings.get(config) === binding) {
      bindings.delete(config)
    }
  }
}

/** 仅由终结命令的 owner 调用，配置重启和独立 snapshot 不清共享事实。 */
export function clearUniAppCompatibilitySession(session: object): void {
  sessions.get(session)?.cache.clear()
  sessions.delete(session)
}

export function getUniAppCompatibilitySessionStats(session: object) {
  return sessions.get(session)?.cache.stats ?? { hits: 0, misses: 0, entries: 0, bytes: 0 }
}

/** gate 每次重新核验；键覆盖转换读取的配置、完整模块身份、块类型和源码字节。 */
export function cacheUniAppCompatibilitySource(
  config: CompatibilityConfig,
  source: string,
  id: string,
  blockType: 'script' | 'style' | 'template' | undefined,
  transform: () => string,
): string {
  const session = bindings.get(config)?.session ?? config
  let state = sessions.get(session)
  if (!state) {
    state = { cache: new UniAppCompatibilityCache(), identities: new WeakMap(), nextIdentity: 0 }
    sessions.set(session, state)
  }
  const identity = config.options?.sourceConfig ?? config
  let scope = state.identities.get(identity)
  if (scope === undefined) {
    scope = ++state.nextIdentity
    state.identities.set(identity, scope)
  }
  const key = JSON.stringify([
    scope,
    config.absoluteSrcRoot,
    config.platform,
    config.weappViteConfig.uniApp || false,
    id,
    blockType,
    'mp-weixin',
  ])
  return state.cache.transform(key, source, transform)
}
