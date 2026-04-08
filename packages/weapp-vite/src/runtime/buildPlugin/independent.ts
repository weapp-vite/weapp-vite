import type { RolldownOutput } from 'rolldown'
import type { MutableCompilerContext } from '../../context'
import type { SubPackageMetaValue } from '../../types'
import { build } from 'vite'
import { logger } from '../../context/shared'
import { createIndependentBuildError } from '../independentError'

interface IndependentBuilderState {
  buildIndependentBundle: (root: string, meta: SubPackageMetaValue) => Promise<RolldownOutput>
  getIndependentOutput: (root: string) => RolldownOutput | undefined
  invalidateIndependentOutput: (root: string) => void
}

function syncImportMetaEnvDefines(
  configService: NonNullable<MutableCompilerContext['configService']>,
  define: Record<string, unknown> | undefined,
) {
  const previous = { ...configService.defineEnv }
  if (!define) {
    return () => {
      configService.defineEnv = previous
    }
  }

  const importMetaEnvPrefix = 'import.meta.env.'
  for (const [key, value] of Object.entries(define)) {
    if (key === 'import.meta.env') {
      try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value
        if (parsed && typeof parsed === 'object') {
          for (const [envKey, envValue] of Object.entries(parsed)) {
            configService.setDefineEnv(envKey, envValue)
          }
        }
      }
      catch {
        // 忽略无法解析的 import.meta.env 聚合定义，保留显式键处理结果。
      }
      continue
    }

    if (!key.startsWith(importMetaEnvPrefix)) {
      continue
    }

    const envKey = key.slice(importMetaEnvPrefix.length)
    try {
      configService.setDefineEnv(envKey, typeof value === 'string' ? JSON.parse(value) : value)
    }
    catch {
      configService.setDefineEnv(envKey, value)
    }
  }

  return () => {
    configService.defineEnv = previous
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
        const inlineConfig = configService.merge(meta, meta.subPackage.inlineConfig, {
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
        const restoreDefineEnv = syncImportMetaEnvDefines(configService, inlineConfig.define as Record<string, unknown> | undefined)
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
