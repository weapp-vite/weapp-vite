import type {
  PlatformBackend,
  PlatformBackendCapability,
  ResolvedBackendExecution,
  ResolvedPlatformBackend,
} from './types'

const RESERVED_COMBINED_TARGETS = new Set(['all', 'both'])

function normalizeBackendKey(value: string) {
  return value.trim().toLowerCase()
}

function createExecution(
  entries: readonly ResolvedPlatformBackend[],
  options: Pick<ResolvedBackendExecution, 'kind' | 'label' | 'raw'>,
): ResolvedBackendExecution {
  return {
    ...options,
    entries,
    get: backendId => entries.find(entry => entry.descriptor.id === backendId),
    has: capability => entries.some(entry => entry.descriptor.capabilities[capability]),
    select: capability => entries.filter(entry => entry.descriptor.capabilities[capability]),
  }
}

export class PlatformBackendRegistry {
  private readonly backends: PlatformBackend[] = []
  private readonly backendById = new Map<string, PlatformBackend>()
  private readonly backendByAlias = new Map<string, PlatformBackend>()

  register(backend: PlatformBackend) {
    const id = normalizeBackendKey(backend.descriptor.id)
    if (!id) {
      throw new Error('平台后端 id 不能为空。')
    }
    if (this.backendById.has(id)) {
      throw new Error(`平台后端 id "${id}" 已注册。`)
    }

    const aliases = [id, ...backend.descriptor.aliases.map(normalizeBackendKey)]
    const uniqueAliases = new Set<string>()
    for (const alias of aliases) {
      if (!alias) {
        continue
      }
      if (RESERVED_COMBINED_TARGETS.has(alias)) {
        throw new Error(`平台后端别名 "${alias}" 为保留目标。`)
      }
      if (uniqueAliases.has(alias)) {
        continue
      }
      const existing = this.backendByAlias.get(alias)
      if (existing) {
        throw new Error(`平台后端别名 "${alias}" 已由 "${existing.descriptor.id}" 注册。`)
      }
      uniqueAliases.add(alias)
    }

    this.backends.push(backend)
    this.backendById.set(id, backend)
    for (const alias of uniqueAliases) {
      this.backendByAlias.set(alias, backend)
    }
  }

  getExecutionOrder(capability?: PlatformBackendCapability): readonly PlatformBackend[] {
    if (!capability) {
      return this.backends
    }
    return this.backends.filter(backend => backend.descriptor.capabilities[capability])
  }

  get(backendId: string): PlatformBackend | undefined {
    return this.backendById.get(normalizeBackendKey(backendId))
  }

  resolve(
    input?: string | null,
    options: {
      fallbackBackendId: string
      fallbackPlatform?: string
      warn?: (message: string) => void
    } = { fallbackBackendId: 'miniprogram' },
  ): ResolvedBackendExecution {
    const raw = typeof input === 'string' ? input : undefined
    const normalized = raw ? normalizeBackendKey(raw) : undefined
    const fallbackBackend = this.backendById.get(normalizeBackendKey(options.fallbackBackendId))
    if (!fallbackBackend) {
      throw new Error(`默认平台后端 "${options.fallbackBackendId}" 未注册。`)
    }

    if (!raw) {
      return createExecution([
        {
          descriptor: fallbackBackend.descriptor,
          driver: fallbackBackend.driver,
        },
      ], {
        kind: fallbackBackend.descriptor.runtime,
        label: 'config',
        raw,
      })
    }
    const targetKey = normalized ?? ''

    if (RESERVED_COMBINED_TARGETS.has(targetKey)) {
      const entries = this.backends.map(backend => ({
        descriptor: backend.descriptor,
        driver: backend.driver,
        platform: backend.descriptor.runtime === 'web'
          ? backend.driver.resolvePlatformAlias?.(backend.descriptor.aliases[0] ?? backend.descriptor.id)
          : undefined,
      }))
      return createExecution(entries, {
        kind: 'all',
        label: 'weapp + web',
        raw,
      })
    }

    const backend = this.backendByAlias.get(targetKey)
    if (backend) {
      const platform = backend.driver.resolvePlatformAlias?.(targetKey)
      return createExecution([
        {
          descriptor: backend.descriptor,
          driver: backend.driver,
          platform,
        },
      ], {
        kind: backend.descriptor.runtime,
        label: platform ?? backend.descriptor.runtime,
        raw,
      })
    }

    const fallbackPlatform = options.fallbackPlatform
      ? fallbackBackend.driver.resolvePlatformAlias?.(options.fallbackPlatform)
      : undefined
    const fallbackLabel = fallbackPlatform ?? fallbackBackend.descriptor.runtime
    options.warn?.(`未识别的平台 "${raw}"，已回退到 ${fallbackLabel}`)
    return createExecution([
      {
        descriptor: fallbackBackend.descriptor,
        driver: fallbackBackend.driver,
        platform: fallbackPlatform,
      },
    ], {
      kind: fallbackBackend.descriptor.runtime,
      label: fallbackLabel,
      raw,
    })
  }
}
