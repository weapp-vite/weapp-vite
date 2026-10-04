import type { VitestPluginContext } from 'vitest/node'
import type { MpcoreArtifactFactory } from './artifact'
import { fileURLToPath } from 'node:url'
import { configureArtifact } from './artifact'

export type { MpcoreArtifactFactory, MpcoreArtifactWatchCallbacks, MpcoreArtifactWatcher } from './artifact'

export interface MpcoreVitestOptions {
  artifact?: MpcoreArtifactFactory
}

export interface MpcoreVitestPlugin {
  config: (config: { test?: { setupFiles?: string | string[] } }) => {
    test: { setupFiles: string[] }
  }
  configureVitest: (context: VitestPluginContext) => Promise<void>
  name: string
}

/** 配置入口仅依赖 runner 的公开类型，不提前加载测试线程的 expect/test。 */
export function mpcoreTest(options: MpcoreVitestOptions = {}): MpcoreVitestPlugin {
  const setupFile = fileURLToPath(new URL('./setup.mjs', import.meta.url))
  return {
    name: 'mpcore:vitest',
    config(config) {
      const existing = config.test?.setupFiles
      const setupFiles = typeof existing === 'string' ? [existing] : existing ?? []
      // Vite 会合并数组，只返回新增项，避免重复执行用户已有的 setup。
      return { test: { setupFiles: setupFiles.includes(setupFile) ? [] : [setupFile] } }
    },
    async configureVitest(context) {
      if (options.artifact) {
        await configureArtifact(options.artifact, context)
      }
    },
  }
}
