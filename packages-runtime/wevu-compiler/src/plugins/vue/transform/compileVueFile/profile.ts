import { performance } from 'node:perf_hooks'

const RECORDER_KEY = '__weappCompilerProfilePhaseRecorder'

interface CompilerPhaseRecorder {
  record: (name: string, durationMs: number) => void
}

function getRecorder() {
  const recorder: unknown = Reflect.get(globalThis, RECORDER_KEY)
  if (!recorder || typeof recorder !== 'object' || typeof Reflect.get(recorder, 'record') !== 'function') {
    return undefined
  }
  return recorder as CompilerPhaseRecorder
}

/** 只在 profile worker 显式安装 recorder 时记录阶段耗时，生产路径不保存阶段状态。 */
export function withCompilerPhase<T>(name: string, run: () => Promise<T>): Promise<T>
export function withCompilerPhase<T>(name: string, run: () => T): T
export function withCompilerPhase<T>(name: string, run: () => T | Promise<T>): T | Promise<T> {
  const recorder = getRecorder()
  if (!recorder) {
    return run()
  }
  const startedAt = performance.now()
  const finish = () => recorder.record(name, performance.now() - startedAt)
  try {
    const result = run()
    if (result && typeof (result as PromiseLike<T>).then === 'function') {
      return Promise.resolve(result).then((value) => {
        finish()
        return value
      }, (error) => {
        finish()
        throw error
      })
    }
    finish()
    return result
  }
  catch (error) {
    finish()
    throw error
  }
}
