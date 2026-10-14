import type { Writable } from 'node:stream'
import process from 'node:process'

/** 只在诊断开启时缓冲输出；完成屏障等待全部写回调，不把背压误当成已交付。 */
export function createBufferedBuildDiagnosticSink(stream: Writable = process.stdout) {
  let pending = 0
  let failed = false
  let disposeRequested = false
  let released = false
  let awaitingNativeError = false
  const observedErrors = new Set<unknown>()
  const waiters = new Set<(drained: boolean) => void>()
  const settle = () => {
    if ((pending || stream.writableNeedDrain) && !failed) {
      return
    }
    for (const resolve of waiters) {
      resolve(!failed)
    }
    waiters.clear()
  }
  const release = (errorListener: (error: unknown) => void) => {
    if (!disposeRequested || pending || awaitingNativeError || released) {
      return
    }
    try {
      stream.off('error', errorListener)
      stream.off('drain', settle)
      released = true
    }
    catch {
      // 诊断收尾不能替换原构建结果。
    }
  }
  const onError = (error: unknown) => {
    observedErrors.add(error)
    if (stream.errored) {
      observedErrors.add(stream.errored)
    }
    awaitingNativeError = false
    failed = true
    settle()
    release(onError)
  }
  const attach = () => {
    stream.on('error', onError)
    stream.on('drain', settle)
    released = false
  }
  attach()
  return {
    write(line: string) {
      if (failed) {
        return
      }
      if (released) {
        // 终结后的事件仍须输出供完整性校验，监听只覆盖此次写入。
        attach()
      }
      pending++
      let completed = false
      const complete = (error?: Error | null) => {
        if (completed) {
          return
        }
        completed = true
        failed ||= Boolean(error)
        if (error && stream.errored && !observedErrors.has(stream.errored)) {
          // 原生 Writable 在写回调之后才发出 error；等该事件终结后释放监听。
          awaitingNativeError = true
        }
        pending--
        settle()
        release(onError)
      }
      try {
        stream.write(line, complete)
      }
      catch (error) {
        complete(error instanceof Error ? error : new Error(String(error)))
      }
    },
    flush(): Promise<boolean> {
      return (pending || stream.writableNeedDrain) && !failed ? new Promise(resolve => waiters.add(resolve)) : Promise.resolve(!failed)
    },
    dispose() {
      disposeRequested = true
      release(onError)
    },
  }
}
