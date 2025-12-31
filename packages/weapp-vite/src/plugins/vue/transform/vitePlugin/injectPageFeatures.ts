import fs from 'fs-extra'
import { injectWevuPageFeaturesInJsWithResolver } from '../../../wevu/pageFeatures'
import { getSourceFromVirtualId } from '../../resolver'

export interface VitePluginResolveLike {
  resolve: (source: string, importer?: string) => Promise<{ id?: string } | null>
}

export async function injectWevuPageFeaturesInJsWithViteResolver(
  ctx: VitePluginResolveLike,
  source: string,
  id: string,
): Promise<{ code: string, transformed: boolean }> {
  return injectWevuPageFeaturesInJsWithResolver(source, {
    id,
    resolver: {
      resolveId: async (importSource, importer) => {
        const resolved = await ctx.resolve(importSource, importer)
        return resolved ? resolved.id : undefined
      },
      loadCode: async (resolvedId) => {
        const clean = getSourceFromVirtualId(resolvedId).split('?', 1)[0]
        if (!clean || clean.startsWith('\0') || clean.startsWith('node:')) {
          return undefined
        }
        try {
          if (await fs.pathExists(clean)) {
            return await fs.readFile(clean, 'utf8')
          }
          return undefined
        }
        catch {
          return undefined
        }
      },
    },
  })
}
