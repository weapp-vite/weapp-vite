import process from 'node:process'

/** 仅在活动入口内捕获取消；重复信号复用同一次收尾，SIGKILL 无法捕获。 */
export function createSuiteSignalScope() {
  const controller = new AbortController()
  let exitCode: 130 | 143 | undefined
  const interrupt = (signal: 'SIGINT' | 'SIGTERM') => {
    if (controller.signal.aborted) {
      return
    }
    exitCode = signal === 'SIGINT' ? 130 : 143
    controller.abort(new Error(`E2E suite cancelled by ${signal}`))
  }
  const onInterrupt = () => interrupt('SIGINT')
  const onTerminate = () => interrupt('SIGTERM')
  process.on('SIGINT', onInterrupt)
  process.on('SIGTERM', onTerminate)
  return {
    signal: controller.signal,
    get exitCode() { return exitCode },
    dispose() {
      process.off('SIGINT', onInterrupt)
      process.off('SIGTERM', onTerminate)
    },
  }
}
