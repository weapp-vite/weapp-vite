interface CoreHmrPage {
  path?: string
}

interface CoreHmrSession {
  currentPage: (options: { appFunctionFallback: false }) => Promise<CoreHmrPage | null>
  reLaunch: (route: string) => Promise<CoreHmrPage | null>
}

type CoreHmrSessionPage<T extends CoreHmrSession> = NonNullable<Awaited<ReturnType<T['currentPage']>>>

function isConnectionClosed(error: unknown) {
  let current = error
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    const { message, code, cause } = current as { message?: unknown, code?: unknown, cause?: unknown }
    if (code === 'ECONNRESET' || code === 'ERR_SOCKET_CLOSED' || code === 'EPIPE'
      || (typeof message === 'string' && /Connection closed, check if wechat web devTools is still running|WebSocket is not open|socket hang up|Target closed/i.test(message))) {
      return true
    }
    current = cause
  }
  return false
}

/** 只导航一次；明确断连时仅重连原 owner，既有断言失败不进入恢复。 */
export async function enterCoreHmrRoute<T extends CoreHmrSession>(options: {
  session: T
  route: string
  beforeNavigate: (session: T) => Promise<void>
  readiness: (session: T, page: CoreHmrPage, timeoutMs: number) => Promise<unknown>
  reconnect?: (session: T) => Promise<T>
  replaceSession: (session: T) => void
}) {
  let session = options.session
  let reconnected = false
  const isExpected = (page: CoreHmrPage | null) => page?.path?.replace(/^\//, '') === options.route.replace(/^\//, '')
  const reconnect = async (error: unknown) => {
    if (reconnected || !options.reconnect || !isConnectionClosed(error)) {
      throw error
    }
    reconnected = true
    try {
      session = await options.reconnect(session)
      options.replaceSession(session)
    }
    catch (reconnectError) {
      throw new AggregateError([error, reconnectError], 'Failed to reconnect the owned core HMR session', { cause: error })
    }
  }
  const readCurrent = async () => {
    try {
      return await session.currentPage({ appFunctionFallback: false })
    }
    catch (error) {
      await reconnect(error)
      return await session.currentPage({ appFunctionFallback: false })
    }
  }
  let page = await readCurrent()
  const alreadyCurrent = isExpected(page)
  if (!alreadyCurrent) {
    await options.beforeNavigate(session)
    try {
      page = await session.reLaunch(options.route)
    }
    catch (error) {
      await reconnect(error)
      page = await readCurrent()
      if (!isExpected(page)) {
        throw new Error(`Core HMR route was not entered before the connection closed: ${options.route}`, { cause: error })
      }
    }
  }
  if (!page || !isExpected(page)) {
    throw new Error(`Core HMR navigation did not reach the expected route: ${options.route}`)
  }
  const deadline = performance.now() + (alreadyCurrent ? 20_000 : 2_600)
  try {
    await options.readiness(session, page, Math.max(0, deadline - performance.now()))
  }
  catch (error) {
    await reconnect(error)
    page = await readCurrent()
    if (!page || !isExpected(page) || performance.now() >= deadline) {
      throw error
    }
    await options.readiness(session, page, deadline - performance.now())
  }
  const confirmed = await readCurrent()
  if (!confirmed || !isExpected(confirmed)) {
    throw new Error(`Current route changed while waiting for HMR readiness: ${options.route}`)
  }
  return confirmed as CoreHmrSessionPage<T>
}
