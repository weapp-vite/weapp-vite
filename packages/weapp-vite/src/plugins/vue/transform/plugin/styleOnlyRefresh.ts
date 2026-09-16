import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { CompilerContext } from '../../../../context'
import type { createReadAndParseSfcOptions, readAndParseSfc } from '../../../utils/vueSfc'
import { preloadTransformSfcStyleBlocks } from './shared'

export interface SfcStyleRefreshState {
  cssVars?: string[]
  styleBlocks?: SFCStyleBlock[]
}

export function createSfcStyleBlocksSignature(styleBlocks: SFCStyleBlock[] | undefined) {
  if (!styleBlocks?.length) {
    return ''
  }
  return JSON.stringify(styleBlocks.map(styleBlock => ({
    attrs: styleBlock.attrs,
    content: styleBlock.content,
    lang: styleBlock.lang,
    module: styleBlock.module,
    scoped: styleBlock.scoped,
  })))
}

interface SfcStyleRefreshOptions {
  filename: string
  source: string
  styleBlocksCache: Map<string, SFCStyleBlock[]>
  force?: boolean
  readAndParseSfc: typeof readAndParseSfc
  createReadAndParseSfcOptions: typeof createReadAndParseSfcOptions
  pluginCtx: Parameters<typeof createReadAndParseSfcOptions>[0]
  configService: NonNullable<CompilerContext['configService']>
}

export async function loadSfcStyleStateForStyleOnlyRefresh(options: SfcStyleRefreshOptions): Promise<SfcStyleRefreshState> {
  const {
    filename,
    source,
    styleBlocksCache,
    force,
    readAndParseSfc,
    createReadAndParseSfcOptions,
    pluginCtx,
    configService,
  } = options
  if (force) {
    styleBlocksCache.delete(filename)
  }
  let cssVars: string[] | undefined
  const styleBlocks = await preloadTransformSfcStyleBlocks({
    filename,
    source,
    styleBlocksCache,
    load: async (target, source) => {
      const parsed = await readAndParseSfc(target, createReadAndParseSfcOptions(pluginCtx, configService, {
        source,
        checkMtime: configService.isDev,
      }))
      cssVars = parsed.descriptor.cssVars
      return parsed.descriptor.styles
    },
  })
  return { cssVars, styleBlocks }
}

export async function loadStyleBlocksForStyleOnlyRefresh(
  options: Parameters<typeof loadSfcStyleStateForStyleOnlyRefresh>[0],
) {
  const state = await loadSfcStyleStateForStyleOnlyRefresh(options)
  return state.styleBlocks
}
