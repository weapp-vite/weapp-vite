import type { RolldownOutput } from 'rolldown'
import type { ResolvedConfig } from 'vite'
import type { MutableCompilerContext } from '../../context'
import type { SubPackageMetaValue } from '../../types'
import { build } from 'vite'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { logger } from '../../context/shared'
import { findAutoImportCandidates } from '../../plugins/autoImport'
import { pickImportMetaEnvDefineEntries } from '../../utils/importMeta'
import { getAutoImportConfig } from '../autoImport/config'
import { createIndependentBuildError } from '../independentError'

interface IndependentBuilderState {
  buildIndependentBundle: (root: string, meta: SubPackageMetaValue) => Promise<RolldownOutput>
  getIndependentOutput: (root: string) => RolldownOutput | undefined
  invalidateIndependentOutput: (root: string) => void
}

function syncImportMetaEnvDefineOverride(
  configService: NonNullable<MutableCompilerContext['configService']>,
  define: Record<string, unknown> | undefined,
) {
  const previous = configService.importMetaEnvDefineOverride
  const next = pickImportMetaEnvDefineEntries(define as Record<string, any> | undefined)
  configService.setImportMetaEnvDefineOverride(next)

  return () => {
    configService.setImportMetaEnvDefineOverride(previous)
  }
}

export function createIndependentBuilder(
  configService: NonNullable<MutableCompilerContext['configService']>,
  buildState: MutableCompilerContext['runtimeState']['build'],
): IndependentBuilderState {
  const independentState = buildState.independent
  const independentBuildTasks = new Map<string, Promise<RolldownOutput>>()

  function storeIndependentOutput(root: string, output: RolldownOutput) {
    independentState.outputs.set(root, output)
  }

  function invalidateIndependentOutput(root: string) {
    independentState.outputs.delete(root)
  }

  function getIndependentOutput(root: string) {
    return independentState.outputs.get(root)
  }

  async function buildIndependentBundle(root: string, meta: SubPackageMetaValue): Promise<RolldownOutput> {
    const existingTask = independentBuildTasks.get(root)
    if (existingTask) {
      return existingTask
    }

    const task = (async () => {
      try {
        const chunkRoot = meta.subPackage.root ?? root
        const isolatedCtx = createCompilerContextInstance()
        await isolatedCtx.configService.load({
          cwd: configService.cwd,
          isDev: configService.isDev,
          mode: configService.mode,
          configFile: configService.configFilePath,
          cliPlatform: configService.platform,
          inlineConfig: {
            weapp: {
              platform: configService.platform,
            },
          },
          projectConfigPath: configService.projectConfigPath,
        })
        const isolatedConfigService = isolatedCtx.configService
        isolatedConfigService.options = {
          ...isolatedConfigService.options,
          currentSubPackageRoot: chunkRoot,
        }
        const inlineConfig = isolatedConfigService.merge(meta, meta.subPackage.inlineConfig, {
          build: {
            write: false,
            watch: null,
            rolldownOptions: {
              output: {
                chunkFileNames() {
                  return `${chunkRoot}/[name].js`
                },
              },
            },
          },
        })
        const autoImportGlobs = getAutoImportConfig(isolatedConfigService)?.globs
        if (autoImportGlobs?.length) {
          const candidates = await findAutoImportCandidates({
            ctx: isolatedCtx,
            resolvedConfig: {
              build: {
                outDir: isolatedConfigService.outDir,
              },
            } as ResolvedConfig,
          }, autoImportGlobs)
          await isolatedCtx.autoImportService.runWithoutOutputWrites(async () => {
            await Promise.all(candidates.map(candidate => isolatedCtx.autoImportService.registerPotentialComponent(candidate)))
          })
        }
        const restoreDefineEnv = syncImportMetaEnvDefineOverride(isolatedConfigService, inlineConfig.define as Record<string, unknown> | undefined)
        let result: RolldownOutput | RolldownOutput[]
        try {
          result = await build(
            inlineConfig,
          ) as RolldownOutput | RolldownOutput[]
        }
        finally {
          restoreDefineEnv()
        }

        const output = Array.isArray(result) ? result[0] : result
        if (!output) {
          throw new Error(`独立分包 ${root} 未产生输出`)
        }
        storeIndependentOutput(root, output)
        return output
      }
      catch (error) {
        const normalized = createIndependentBuildError(root, error)
        invalidateIndependentOutput(root)
        logger.error(`[独立分包] ${root} 构建失败：${normalized.message}`)
        throw normalized
      }
      finally {
        independentBuildTasks.delete(root)
      }
    })()

    independentBuildTasks.set(root, task)
    return task
  }

  return {
    buildIndependentBundle,
    getIndependentOutput,
    invalidateIndependentOutput,
  }
}
