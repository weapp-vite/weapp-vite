import type { PluginContext, ResolvedId } from 'rolldown'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { createCachedEntryResolveOptions, resolveEntryPath } from '../../../../utils/entryResolve'

export interface ResolvedEntryRecord {
  entry: string
  resolvedId: ResolvedId | null
}

export function createEntryResolver(configService?: { isDev?: boolean }) {
  const entryResolutionCache = new Map<string, ResolvedId | null>()

  async function resolveEntryWithCache(pluginCtx: PluginContext, absPath: string) {
    const normalized = path.normalize(absPath)
    if (entryResolutionCache.has(normalized)) {
      return entryResolutionCache.get(normalized) ?? null
    }
    let resolvedSource = normalized
    if (!path.extname(normalized)) {
      const matched = await resolveEntryPath(normalized, createCachedEntryResolveOptions(configService ?? {}, {
        kind: 'default',
      }))
      if (matched) {
        resolvedSource = matched
      }
    }
    const resolved = await pluginCtx.resolve(resolvedSource)
    if (resolved?.id && configService?.isDev && path.isAbsolute(resolved.id)) {
      const [resolvedPathWithoutQuery] = resolved.id.split('?')
      if (!resolvedPathWithoutQuery || !await fs.pathExists(resolvedPathWithoutQuery)) {
        return null
      }
    }
    const resolvedId = resolved
      ?? (path.isAbsolute(resolvedSource) && await fs.pathExists(resolvedSource)
        ? { id: resolvedSource } as ResolvedId
        : null)
    if (resolvedId || !configService?.isDev) {
      entryResolutionCache.set(normalized, resolvedId)
    }
    return resolvedId
  }

  async function resolveEntriesWithCache(
    pluginCtx: PluginContext,
    entries: string[],
    absoluteRoot: string,
  ): Promise<ResolvedEntryRecord[]> {
    return Promise.all(
      entries
        .filter(entry => !entry.includes(':'))
        .map(async (entry) => {
          const absPath = path.resolve(absoluteRoot, entry)
          return {
            entry,
            resolvedId: await resolveEntryWithCache(pluginCtx, absPath),
          }
        }),
    )
  }

  return {
    resolveEntryWithCache,
    resolveEntriesWithCache,
    invalidate() {
      entryResolutionCache.clear()
    },
  }
}
