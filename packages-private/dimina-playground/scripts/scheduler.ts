/** 串行合并重建请求；失败后仍接受下一轮修改。 */
export function createRebuildScheduler(rebuild: () => Promise<void>, onError: (error: unknown) => void) {
  let pending = false
  let closed = false
  let active: Promise<void> | undefined
  function schedule(): Promise<void> {
    if (closed) {
      return Promise.resolve()
    }
    pending = true
    active ??= (async () => {
      while (pending) {
        if (closed) {
          break
        }
        pending = false
        try {
          await rebuild()
        }
        catch (error) {
          onError(error)
        }
      }
    })().finally(() => {
      active = undefined
    })
    return active
  }
  return {
    schedule,
    async close() {
      closed = true
      await active
    },
  }
}
