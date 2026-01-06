import { normalizeViteId } from '../../../../utils/viteId'
import { readFile as readFileCached } from '../../../utils/cache'
import { injectWevuPageFeaturesInJsWithResolver } from '../../../wevu/pageFeatures'

export interface VitePluginResolveLike {
  resolve: (source: string, importer?: string) => Promise<{ id?: string } | null>
}

export async function injectWevuPageFeaturesInJsWithViteResolver(
  ctx: VitePluginResolveLike,
  source: string,
  id: string,
  options?: { checkMtime?: boolean },
): Promise<{ code: string, transformed: boolean }> {
  const checkMtime = options?.checkMtime ?? true
  return injectWevuPageFeaturesInJsWithResolver(source, {
    id,
    resolver: {
      resolveId: async (importSource, importer) => {
        const resolved = await ctx.resolve(importSource, importer)
        return resolved ? resolved.id : undefined
      },
      loadCode: async (resolvedId) => {
        const clean = normalizeViteId(resolvedId, { stripVueVirtualPrefix: true })
        if (!clean || clean.startsWith('\0') || clean.startsWith('node:')) {
          return undefined
        }
        try {
          return await readFileCached(clean, { checkMtime })
        }
        catch {
          return undefined
        }
      },
    },
  })
}
