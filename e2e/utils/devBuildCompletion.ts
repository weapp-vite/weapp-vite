import type { startDevProcess } from './dev-process'

type DevProcess = Pick<ReturnType<typeof startDevProcess>, 'getOutput' | 'waitFor'>

/** 在编辑前记录游标；文件提前可见或上一轮完成日志都不能代替本轮发布完成。 */
export function createDevBuildCompletion(dev: DevProcess, options: {
  completed: string
  started?: string
}) {
  const offset = dev.getOutput().length
  return {
    async wait(timeoutMs = 30_000): Promise<void> {
      const completion = Promise.withResolvers<void>()
      const check = () => {
        try {
          const output = dev.getOutput().slice(offset)
          const completedAt = output.lastIndexOf(options.completed)
          const startedAt = options.started ? output.lastIndexOf(options.started) : -1
          if (completedAt >= 0 && completedAt > startedAt) {
            completion.resolve()
          }
        }
        catch (error) {
          completion.reject(error)
        }
      }
      const interval = setInterval(check, 25)
      const deadline = setTimeout(() => completion.reject(new Error(`Timed out waiting for current dev build: ${options.completed}`)), timeoutMs)
      try {
        check()
        await dev.waitFor(completion.promise, 'current dev build publication')
      }
      finally {
        clearInterval(interval)
        clearTimeout(deadline)
      }
    },
  }
}
