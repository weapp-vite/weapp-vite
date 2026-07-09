import type { EncodedSourceMapLike } from '../../../utils/sourcemap'
import { injectWevuPageFeaturesInJsWithResolver } from 'wevu/compiler'
import { normalizeEncodedSourceMapLike } from '../../../utils/sourcemap'
import { readFile as readFileCached } from '../../utils/cache'
import { createViteResolverAdapter } from '../../utils/viteResolverAdapter'

export interface VitePluginResolveLike {
  resolve: (source: string, importer?: string) => Promise<{ id?: string } | null>
}

export async function injectWevuPageFeaturesInJsWithViteResolver(
  ctx: VitePluginResolveLike,
  source: string,
  id: string,
  options?: { checkMtime?: boolean, minify?: boolean, sourceMap?: boolean },
): Promise<{ code: string, transformed: boolean, map?: EncodedSourceMapLike | null }> {
  const checkMtime = options?.checkMtime ?? true
  const injected = await injectWevuPageFeaturesInJsWithResolver(source, {
    id,
    resolver: createViteResolverAdapter(
      { resolve: (source, importer) => ctx.resolve(source, importer) },
      { readFile: readFileCached },
      { checkMtime },
    ),
    minify: options?.minify,
    sourceMap: options?.sourceMap,
  })
  return {
    ...injected,
    map: normalizeEncodedSourceMapLike(injected.map),
  }
}
