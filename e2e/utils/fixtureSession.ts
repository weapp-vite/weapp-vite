/** 一个 fixture owner 独占构建、启动与收尾；首错锁存，关闭失败仍允许精确重试。 */
export function createFixtureSessionOwner<T>(options: {
  build: () => Promise<unknown>
  launch: () => Promise<T>
  close: (session: T) => Promise<unknown>
  deferClose?: () => boolean
}) {
  let pending: Promise<T> | undefined
  let closing: Promise<void> | undefined
  let closed = false
  return {
    get() {
      if (closed || closing) {
        return Promise.reject(new Error('Fixture session owner is closing or has already closed'))
      }
      pending ??= Promise.resolve().then(options.build).then(options.launch)
      return pending
    },
    close(force = false): Promise<void> {
      if (closed || (!force && options.deferClose?.())) {
        return Promise.resolve()
      }
      closing ??= (async () => {
        const session = await pending?.catch(() => undefined)
        if (session !== undefined) {
          await options.close(session)
        }
        closed = true
      })().catch((error) => {
        closing = undefined
        throw error
      })
      return closing
    },
  }
}
