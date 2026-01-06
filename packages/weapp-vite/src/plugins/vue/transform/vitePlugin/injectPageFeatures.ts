import { readFile as readFileCached } from '../../../utils/cache'
import { createViteResolverAdapter } from '../../../utils/viteResolverAdapter'
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
    resolver: createViteResolverAdapter(
      { resolve: (source, importer) => ctx.resolve(source, importer) },
      { readFile: readFileCached },
      { checkMtime },
    ),
  })
}
