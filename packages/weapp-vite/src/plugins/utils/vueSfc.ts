import type { ReadAndParseSfcOptions, ResolveSfcBlockSrcOptions } from 'wevu/compiler'
import type { CompilerContext } from '../../context'
import { getSfcCheckMtime } from 'wevu/compiler'

export {
  preprocessScriptSetupSrc,
  preprocessScriptSrc,
  readAndParseSfc,
  resolveSfcBlockSrc,
  restoreScriptSetupSrc,
  restoreScriptSrc,
} from 'wevu/compiler'
export { getSfcCheckMtime }
export type { ReadAndParseSfcOptions, ResolveSfcBlockSrcOptions } from 'wevu/compiler'

export function createSfcResolveSrcOptions(
  pluginCtx: {
    resolve?: (source: string, importer?: string) => Promise<{ id?: string } | null | undefined> | { id?: string } | null | undefined
  },
  configService: CompilerContext['configService'],
): ResolveSfcBlockSrcOptions {
  return {
    resolveId: async (source, importer) => {
      if (typeof pluginCtx.resolve !== 'function') {
        return undefined
      }
      const resolved = await pluginCtx.resolve(source, importer)
      return resolved?.id
    },
    checkMtime: getSfcCheckMtime(configService),
  }
}

export function createReadAndParseSfcOptions(
  pluginCtx: {
    resolve?: (source: string, importer?: string) => Promise<{ id?: string } | null | undefined> | { id?: string } | null | undefined
  },
  configService: CompilerContext['configService'],
  options?: Pick<ReadAndParseSfcOptions, 'source' | 'checkMtime'>,
): ReadAndParseSfcOptions {
  const resolveCheckMtime = getSfcCheckMtime(configService)

  return {
    source: options?.source,
    checkMtime: options?.checkMtime ?? resolveCheckMtime,
    resolveSrc: createSfcResolveSrcOptions(pluginCtx, configService),
  }
}
