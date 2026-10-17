interface ManagedSession {
  close: (...args: any[]) => Promise<any>
  disconnect: (...args: any[]) => void | Promise<void>
}

const projectOwners = new WeakMap<object, () => Promise<void>>()

/** 重连复用原窗口 owner，不把连接生命周期误当作窗口所有权。 */
export function getManagedProjectSessionOwner(session: object) {
  return projectOwners.get(session)
}

/** 连接断开不释放窗口所有权；受管关闭只使用独立 owner，避免协议误关复用窗口。 */
export function attachManagedProjectSession<T extends ManagedSession>(session: T, closeProject: () => Promise<void>): T {
  projectOwners.set(session, closeProject)
  let closing: Promise<void> | undefined
  let disconnectPromise: Promise<void> | undefined
  const disconnect = session.disconnect.bind(session)
  session.disconnect = (...args: any[]) => {
    if (!disconnectPromise) {
      try {
        disconnectPromise = Promise.resolve(disconnect(...args)).catch((error: unknown) => {
          disconnectPromise = undefined
          throw error
        })
      }
      catch (error) {
        disconnectPromise = Promise.reject(error).catch((failure: unknown) => {
          disconnectPromise = undefined
          throw failure
        })
      }
    }
    return disconnectPromise
  }
  session.close = () => {
    closing ??= (async () => {
      const errors: unknown[] = []
      try {
        await session.disconnect()
      }
      catch (error) {
        errors.push(error)
      }
      try {
        await closeProject()
      }
      catch (error) {
        errors.push(error)
      }
      if (errors.length) {
        throw new AggregateError(errors, 'Managed IDE session cleanup failed')
      }
    })().catch((error: unknown) => {
      closing = undefined
      throw error
    })
    return closing
  }
  return session
}
