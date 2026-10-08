import type { CompilerObservation } from './types'

export interface CompilerProfiler {
  measure: <T>(name: string, run: () => T) => T
  measureAsync: <T>(name: string, run: () => Promise<T>) => Promise<T>
  count: (operation: keyof CompilerObservation['counters']) => void
}

let profiler: CompilerProfiler | undefined

/** 显式观测入口持有适配器；常规编译路径不加载宿主诊断能力。 */
export function installCompilerProfiler(adapter: CompilerProfiler) {
  if (profiler) {
    throw new Error('A compiler profiler is already installed')
  }
  profiler = adapter
  let installed = true
  return () => {
    if (installed && profiler === adapter) {
      profiler = undefined
      installed = false
    }
  }
}

/** 未安装观测器时直接执行，不读取时钟或初始化宿主上下文。 */
export function measureCompilerStage<T>(name: string, run: () => T): T {
  return profiler ? profiler.measure(name, run) : run()
}

/** 异步阶段保留调用方原有 Promise 与异常语义。 */
export function measureCompilerStageAsync<T>(name: string, run: () => Promise<T>): Promise<T> {
  return profiler ? profiler.measureAsync(name, run) : run()
}

/** 计数只代表真实 Babel 包装入口调用，不推算第三方编译器内部解析次数。 */
export function countCompilerOperation(operation: keyof CompilerObservation['counters']) {
  profiler?.count(operation)
}
