/**
 * @file 异步控制工具。
 */
/** 可取消的延迟，取消时释放自身计时器。 */
export function sleep(timeout: number, signal?: AbortSignal) {
  signal?.throwIfAborted()
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>
    function abort() {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      reject(signal?.reason)
    }
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, timeout)
    signal?.addEventListener('abort', abort, { once: true })
  })
}

/** 条件轮询受同一个单调时钟 deadline 与取消信号约束。 */
export async function waitUntil(condition: () => unknown | Promise<unknown>, timeout = 0, interval = 250, signal?: AbortSignal) {
  const deadlineAt = timeout ? performance.now() + timeout : Number.POSITIVE_INFINITY
  while (true) {
    signal?.throwIfAborted()
    const value = await condition()
    signal?.throwIfAborted()
    if (value) {
      return value
    }
    const remaining = deadlineAt - performance.now()
    if (remaining <= 0) {
      throw new Error(`Wait timed out after ${timeout} ms`)
    }
    await sleep(Math.min(interval, remaining), signal)
  }
}
