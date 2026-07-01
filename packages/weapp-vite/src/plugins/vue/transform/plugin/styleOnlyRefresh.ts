import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { CompilerContext } from '../../../../context'
import { preloadTransformSfcStyleBlocks } from './shared'

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

export async function loadStyleBlocksForStyleOnlyRefresh(options: {
  filename: string
  source: string
  styleBlocksCache: Map<string, SFCStyleBlock[]>
  readAndParseSfc: typeof import('../../../utils/vueSfc').readAndParseSfc
  createReadAndParseSfcOptions: typeof import('../../../utils/vueSfc').createReadAndParseSfcOptions
  pluginCtx: any
  configService: NonNullable<CompilerContext['configService']>
}) {
  const {
    filename,
    source,
    styleBlocksCache,
    readAndParseSfc,
    createReadAndParseSfcOptions,
    pluginCtx,
    configService,
  } = options
  await preloadTransformSfcStyleBlocks({
    filename,
    source,
    styleBlocksCache,
    load: async (target, source) => {
      const parsed = await readAndParseSfc(target, createReadAndParseSfcOptions(pluginCtx, configService, {
        source,
        checkMtime: configService.isDev,
      }))
      return parsed.descriptor.styles
    },
  })
  return styleBlocksCache.get(filename)
}
