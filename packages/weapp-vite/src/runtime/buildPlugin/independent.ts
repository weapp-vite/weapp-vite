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
        const result = await build(
          inlineConfig,
        ) as RolldownOutput | RolldownOutput[]

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
