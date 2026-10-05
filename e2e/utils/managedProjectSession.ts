interface ManagedSession {
  close: (...args: any[]) => Promise<any>
  disconnect: (...args: any[]) => any
}

/** 连接断开不释放窗口所有权；受管关闭只使用独立 owner，避免协议误关复用窗口。 */
export function attachManagedProjectSession<T extends ManagedSession>(session: T, closeProject: () => Promise<void>): T {
  let closing: Promise<void> | undefined
  let disconnected = false
  const disconnect = session.disconnect.bind(session)
  session.disconnect = (...args: any[]) => {
    if (disconnected) {
      return
    }
    disconnected = true
    return disconnect(...args)
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
