import process from 'node:process'

class SuiteCancellationError extends Error {
  constructor(readonly exitCode: 130 | 143, signal: 'SIGINT' | 'SIGTERM') {
    super(`E2E suite cancelled by ${signal}`)
  }
}

/** 仅在活动入口内捕获取消；重复信号复用同一次收尾，SIGKILL 无法捕获。 */
export function createSuiteSignalScope(parentSignal?: AbortSignal) {
  const controller = new AbortController()
  let exitCode: 130 | 143 | undefined
  const interrupt = (signal: 'SIGINT' | 'SIGTERM') => {
    if (controller.signal.aborted) {
      return
    }
    exitCode = signal === 'SIGINT' ? 130 : 143
    controller.abort(new SuiteCancellationError(exitCode, signal))
  }
  const onInterrupt = () => interrupt('SIGINT')
  const onTerminate = () => interrupt('SIGTERM')
  const inheritCancellation = () => {
    if (controller.signal.aborted) {
      return
    }
    const reason: unknown = parentSignal?.reason
    if (reason instanceof SuiteCancellationError) {
      exitCode = reason.exitCode
    }
    controller.abort(reason)
  }
  if (parentSignal) {
    parentSignal.addEventListener('abort', inheritCancellation, { once: true })
    if (parentSignal.aborted) {
      inheritCancellation()
    }
  }
  else {
    process.on('SIGINT', onInterrupt)
    process.on('SIGTERM', onTerminate)
  }
  return {
    signal: controller.signal,
    cancel(reason: unknown) {
      if (!controller.signal.aborted) {
        controller.abort(reason)
      }
    },
    get exitCode() { return exitCode },
    dispose() {
      process.off('SIGINT', onInterrupt)
      process.off('SIGTERM', onTerminate)
      parentSignal?.removeEventListener('abort', inheritCancellation)
    },
  }
}
