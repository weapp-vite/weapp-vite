import type { PluginContext, ResolvedId } from 'rolldown'
import fs from 'fs-extra'
import path from 'pathe'
import { resolveEntryPath } from '../../../../utils/entryResolve'

export interface ResolvedEntryRecord {
  entry: string
  resolvedId: ResolvedId | null
}

export function createEntryResolver() {
  const entryResolutionCache = new Map<string, ResolvedId | null>()

  async function resolveEntryWithCache(pluginCtx: PluginContext, absPath: string) {
    const normalized = path.normalize(absPath)
    if (entryResolutionCache.has(normalized)) {
      return entryResolutionCache.get(normalized) ?? null
    }
    let resolvedSource = normalized
    if (!path.extname(normalized)) {
      const matched = await resolveEntryPath(normalized, {
        kind: 'default',
        exists: (p: string) => fs.pathExists(p),
        stat: (p: string) => fs.stat(p) as any,
      })
      if (matched) {
        resolvedSource = matched
      }
    }
    const resolved = await pluginCtx.resolve(resolvedSource)
    const resolvedId = resolved ?? null
    entryResolutionCache.set(normalized, resolvedId)
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
