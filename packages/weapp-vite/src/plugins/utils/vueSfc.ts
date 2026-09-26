import type { ReadAndParseSfcOptions, ResolveSfcBlockSrcOptions } from 'wevu/compiler'
import type { CompilerContext } from '../../context'
import { getSfcCheckMtime, readFile, readAndParseSfc as readSfc } from 'wevu/compiler'
import { getCompilerHmrHostByConfig } from '../compilerPlugin/hmr'
import { getCompilerSourceSnapshot, readCompilerInput, readCompilerSourceSnapshot } from './sourceSnapshot'

export {
  preprocessScriptSetupSrc,
  preprocessScriptSrc,
  resolveSfcBlockSrc,
  restoreScriptSetupSrc,
  restoreScriptSrc,
} from 'wevu/compiler'
export { getSfcCheckMtime }
export type { ReadAndParseSfcOptions, ResolveSfcBlockSrcOptions } from 'wevu/compiler'

type SnapshotReadOptions = ReadAndParseSfcOptions & { sourceSnapshot?: ReadonlyMap<string, string | null> }

/** 模板扫描与模块转换使用同一份批次源码。 */
export function readAndParseSfc(filename: string, options?: SnapshotReadOptions) {
  return readSfc(filename, {
    ...options,
    source: options?.source ?? readCompilerSourceSnapshot(options?.sourceSnapshot, filename),
  })
}

export function createSfcResolveSrcOptions(
  pluginCtx: {
    resolve?: (source: string, importer?: string) => Promise<{ id?: string } | null | undefined> | { id?: string } | null | undefined
  },
  configService: CompilerContext['configService'],
): ResolveSfcBlockSrcOptions {
  const snapshot = getCompilerSourceSnapshot(configService)
  const host = getCompilerHmrHostByConfig(configService)
  return {
    ...(snapshot || host?.onDependencyChange
      ? {
          readFile: async (id: string, options?: { checkMtime?: boolean }) => {
            const source = snapshot ? await readCompilerInput(configService, id) : await readFile(id, options)
            if (!snapshot) {
              host?.captureNative(id, source)
            }
            return source
          },
        }
      : {}),
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
): SnapshotReadOptions {
  const resolveCheckMtime = getSfcCheckMtime(configService)
  const sourceSnapshot = getCompilerSourceSnapshot(configService)

  return {
    ...(sourceSnapshot ? { sourceSnapshot } : {}),
    source: options?.source,
    checkMtime: options?.checkMtime ?? resolveCheckMtime,
    resolveSrc: createSfcResolveSrcOptions(pluginCtx, configService),
  }
}
