/** 测试超时只取消计时等待；先取消并收齐实际 I/O，再删除夹具目录。 */
export function createTaskScope(testSignal: AbortSignal) {
  const controller = new AbortController()
  const signal = AbortSignal.any([testSignal, controller.signal])
  const pending = new Set<Promise<unknown>>()
  return {
    signal,
    run<T>(operation: () => Promise<T>): Promise<T> {
      signal.throwIfAborted()
      const task = operation()
      pending.add(task)
      void task.then(() => pending.delete(task), () => pending.delete(task))
      return task
    },
    async close() {
      controller.abort()
      await Promise.allSettled(pending)
    },
  }
}
