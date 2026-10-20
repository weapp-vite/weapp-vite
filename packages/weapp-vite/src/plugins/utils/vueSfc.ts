import type { ReadAndParseSfcOptions, ResolveSfcBlockSrcOptions } from 'wevu/compiler'
import type { CompilerContext } from '../../context'
import { getSfcCheckMtime, readFile, readAndParseSfc as readSfc } from 'wevu/compiler'
import { getCompilerHmrHostByConfig } from '../compilerPlugin/hmr'
import { recordSfcBlockSource } from './sfcTemplateDependencies'
import { compilerSnapshotSourceId, compilerSourceResolutionKey, getCompilerSourceResolutions, getCompilerSourceSnapshot, readCompilerInput, readCompilerSourceSnapshot } from './sourceSnapshot'

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
  const options: ResolveSfcBlockSrcOptions = {
    ...(snapshot || host?.onDependencyChange
      ? {
          readFile: async (id: string, options?: { checkMtime?: boolean }) => {
            const source = snapshot ? await readCompilerInput(configService, id) : await readFile(id, options)
            if (!snapshot) {
              host?.captureRaw(id, source)
            }
            return source
          },
        }
      : {}),
    resolveId: async (source, importer) => {
      const resolutions = getCompilerSourceResolutions(configService)
      const key = importer && compilerSourceResolutionKey(source, compilerSnapshotSourceId(snapshot, importer))
      if (key && resolutions?.has(key)) {
        const resolved = resolutions.get(key)
        if (importer) {
          recordSfcBlockSource(options, source, importer, resolved)
        }
        return resolved
      }
      if (typeof pluginCtx.resolve !== 'function') {
        if (importer) {
          recordSfcBlockSource(options, source, importer)
        }
        return undefined
      }
      const resolved = await pluginCtx.resolve(source, importer)
      if (importer) {
        recordSfcBlockSource(options, source, importer, resolved?.id)
      }
      return resolved?.id
    },
    checkMtime: getSfcCheckMtime(configService),
  }
  return options
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
