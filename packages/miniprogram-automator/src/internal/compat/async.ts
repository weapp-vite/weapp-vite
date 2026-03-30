/**
 * @file 异步控制工具。
 */
/** sleep 的方法封装。 */
export function sleep(timeout: number) {
  return new Promise<void>(resolve => setTimeout(resolve, timeout))
}

/** waitUntil 的方法封装。 */
export async function waitUntil(condition: () => unknown | Promise<unknown>, timeout = 0, interval = 250) {
  const startTime = Date.now()

  while (true) {
    const value = await condition()
    if (value) {
      return value
    }

    if (timeout && Date.now() - startTime >= timeout) {
      throw new Error(`Wait timed out after ${timeout} ms`)
    }

    await sleep(interval)
  }
}
