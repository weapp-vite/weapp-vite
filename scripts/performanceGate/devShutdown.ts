import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { waitForInspectorUrl } from '../../e2e/utils/dev-memory'
import { startDevProcess } from '../../e2e/utils/dev-process'
import { historicalBaselineSha } from './historicalBaseline.mjs'
import { HISTORICAL_SHUTDOWN_WORK_BUDGET_MS, requestHistoricalBaselineShutdown } from './historicalShutdown'

const sideEnv = 'WEAPP_VITE_PERF_SHUTDOWN_SIDE'
const commitEnv = 'WEAPP_VITE_PERF_SHUTDOWN_COMMIT'

/** 每侧显式覆盖继承身份，候选即使与历史基线同 SHA 也保留 IPC 验收。 */
export function benchmarkShutdownEnvironment(side: 'baseline' | 'optimized', commit: string) {
  return { [sideEnv]: side, [commitEnv]: commit }
}

/** 旧基线通过已有 inspector 进入自身 Ctrl+C 关闭链；其余开发进程维持原有严格收尾。 */
export function startBenchmarkDevProcess(args: readonly string[], options: NonNullable<Parameters<typeof startDevProcess>[2]>) {
  const env = options.env ?? process.env
  const cwd = path.resolve(options.cwd instanceof URL ? fileURLToPath(options.cwd) : options.cwd ?? process.cwd())
  const legacy = env[sideEnv] === 'baseline' && env[commitEnv] === historicalBaselineSha
  const dev = startDevProcess(process.execPath, args, {
    ...options,
    ...(legacy
      ? {
          // 两侧保留相同启动通道；历史基线只替换关闭请求，不主动断开 IPC。
          ipc: true,
          gracefulShutdown: async () => {
            // URL 发现也计入既有关闭预算，另留控制释放和自然退出时间。
            const deadline = Date.now() + HISTORICAL_SHUTDOWN_WORK_BUDGET_MS
            const inspectorUrl = await waitForInspectorUrl(() => dev.getOutput(), 'historical baseline shutdown', Math.min(10_000, HISTORICAL_SHUTDOWN_WORK_BUDGET_MS))
            const remaining = deadline - Date.now()
            if (remaining <= 0) {
              throw new Error('Historical baseline shutdown budget exhausted during inspector discovery')
            }
            await requestHistoricalBaselineShutdown(inspectorUrl, path.resolve(cwd, 'package.json'), remaining)
          },
        }
      : {}),
  })
  return dev
}
