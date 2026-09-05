import type {} from 'devframe'
import type {
  DevframeConnectionStatus,
  DevframeRpcClient,
  DevframeScopedClientContext,
} from 'devframe/client'
import type { DashboardRuntimeEvent } from '../../types'
import type {
  DashboardAnalyzePage,
  DashboardAnalyzePageRequest,
  DashboardAnalyzePayloadDescriptor,
  DashboardAnalyzeSnapshot,
  DashboardDevframeState,
  DashboardFileContent,
  DashboardFileKind,
} from './payload'
import { connectDevframe, consumeOtpFromUrl } from 'devframe/client'
import { shallowRef } from 'vue'
import { normalizeRuntimeEvents } from '../runtimeEvents'
import { readDashboardAnalyzeSnapshot } from './payload'

const DEVFRAME_ID = 'weapp-vite' as const
const DASHBOARD_DEVFRAME_BASE = '/__weapp-vite/'
const RECONNECT_DELAYS_MS = [250, 500, 1_000, 2_000, 5_000] as const
const STALE_DASHBOARD_ANALYZE_REVISION_RE = /Analyze revision|revision.*Dashboard 状态/i

type DashboardScopedClient = DevframeScopedClientContext<typeof DEVFRAME_ID>

interface DashboardConnectionSession {
  client: DevframeRpcClient
  dashboard: DashboardScopedClient
  dispose: () => void
  disposed: boolean
  pendingState?: DashboardDevframeState
  refreshPromise?: Promise<void>
  revision: number
}

class DashboardAuthorizationError extends Error {
  override name = 'DashboardAuthorizationError'
}

declare module 'devframe' {
  interface DevframeRpcClientFunctions {
    'weapp-vite:dashboard-state-updated': (state: DashboardDevframeState) => void
  }

  interface DevframeRpcServerFunctions {
    'weapp-vite:get-dashboard-state': () => DashboardDevframeState
    'weapp-vite:get-analyze-page': (input: DashboardAnalyzePageRequest) => DashboardAnalyzePage
    'weapp-vite:read-dashboard-file': (input: { kind: DashboardFileKind, path: string }) => Promise<DashboardFileContent>
  }
}

export const dashboardAnalyzeSnapshot = shallowRef<DashboardAnalyzeSnapshot | null>(null)
export const dashboardConnectionError = shallowRef<Error | null>(null)
export const dashboardConnectionStatus = shallowRef<DevframeConnectionStatus>('connecting')
export const dashboardRuntimeEvents = shallowRef<DashboardRuntimeEvent[]>([])

let activeSession: DashboardConnectionSession | undefined
let connectPromise: Promise<void> | undefined
let reconnectAttempt = 0
let reconnectTimer: NodeJS.Timeout | number | undefined
let reconnectDashboard: (() => Promise<void>) | undefined

function syncConnectionState(client: DevframeRpcClient) {
  dashboardConnectionStatus.value = client.status
  dashboardConnectionError.value = client.connectionError
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = undefined
  }
}

function disposeSession(session: DashboardConnectionSession, close: boolean) {
  if (session.disposed) {
    return
  }
  session.disposed = true
  session.dispose()
  if (activeSession === session) {
    activeSession = undefined
  }
  if (close) {
    session.client.close?.()
  }
}

function scheduleReconnect() {
  if (reconnectTimer || activeSession) {
    return
  }
  const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)]
  reconnectAttempt += 1
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined
    dashboardConnectionStatus.value = 'connecting'
    if (!reconnectDashboard) {
      dashboardConnectionStatus.value = 'error'
      dashboardConnectionError.value = new Error('Devframe Dashboard 重连状态机尚未初始化。')
      return
    }
    void reconnectDashboard().catch(() => {})
  }, delay)
}

function handleSessionFailure(session: DashboardConnectionSession, error: unknown) {
  if (activeSession !== session || session.disposed) {
    return
  }
  const status = session.client.status
  syncConnectionState(session.client)
  if (error) {
    dashboardConnectionError.value = error instanceof Error ? error : new Error(String(error))
  }
  if (status !== 'disconnected' && status !== 'error' && status !== 'unauthorized') {
    return
  }
  disposeSession(session, true)
  if (status !== 'unauthorized') {
    scheduleReconnect()
  }
}

function handleRefreshFailure(session: DashboardConnectionSession, error: unknown) {
  if (activeSession !== session || session.disposed) {
    return
  }
  dashboardConnectionStatus.value = 'error'
  dashboardConnectionError.value = error instanceof Error ? error : new Error(String(error))
  disposeSession(session, true)
  scheduleReconnect()
}

function isStaleAnalyzeRevisionError(error: unknown) {
  return error instanceof Error && STALE_DASHBOARD_ANALYZE_REVISION_RE.test(error.message)
}

async function hydrateDashboardState(
  session: DashboardConnectionSession,
  initialState?: DashboardDevframeState,
) {
  if (session.disposed) {
    return
  }
  if (session.refreshPromise) {
    session.pendingState = initialState
    return await session.refreshPromise
  }

  session.pendingState = initialState
  session.refreshPromise = (async () => {
    do {
      let state = session.pendingState
      session.pendingState = undefined
      state ??= await session.dashboard.rpc.call('get-dashboard-state')
      dashboardRuntimeEvents.value = normalizeRuntimeEvents(state.runtimeEvents)
      if (state.revision === session.revision && dashboardAnalyzeSnapshot.value) {
        continue
      }

      let snapshot: DashboardAnalyzeSnapshot
      try {
        snapshot = await readDashboardAnalyzeSnapshot(session.dashboard.rpc, state.analyze, state.revision)
      }
      catch (error) {
        if (!isStaleAnalyzeRevisionError(error)) {
          throw error
        }
        session.pendingState = await session.dashboard.rpc.call('get-dashboard-state')
        continue
      }
      if (session.disposed) {
        return
      }
      if (session.pendingState) {
        continue
      }
      session.revision = state.revision
      dashboardAnalyzeSnapshot.value = snapshot
    } while (session.pendingState)
  })()

  try {
    await session.refreshPromise
  }
  finally {
    session.refreshPromise = undefined
  }
}

function createDashboardSession(client: DevframeRpcClient): DashboardConnectionSession {
  const dashboard = client.scope(DEVFRAME_ID)
  const session: DashboardConnectionSession = {
    client,
    dashboard,
    dispose: () => {},
    disposed: false,
    revision: -1,
  }
  dashboard.rpc.register({
    name: 'dashboard-state-updated',
    type: 'event',
    handler: (state: DashboardDevframeState) => {
      if (session.disposed) {
        return
      }
      void hydrateDashboardState(session, state).catch((error) => {
        handleRefreshFailure(session, error)
      })
    },
  })
  const disposeStatus = client.events.on('connection:status', () => {
    if (client.status === 'connected') {
      reconnectAttempt = 0
      syncConnectionState(client)
      return
    }
    handleSessionFailure(session, client.connectionError)
  })
  const disposeError = client.events.on('connection:error', (error) => {
    handleSessionFailure(session, error)
  })
  session.dispose = () => {
    disposeStatus()
    disposeError()
  }
  return session
}

async function initializeDashboardDevframe() {
  const client = await connectDevframe({
    baseURL: DASHBOARD_DEVFRAME_BASE,
    callTimeout: 30_000,
  })
  let session: DashboardConnectionSession | undefined
  try {
    if (!await client.ensureTrusted()) {
      throw new DashboardAuthorizationError('Devframe 未授权当前 Dashboard 连接。')
    }

    session = createDashboardSession(client)
    activeSession = session
    syncConnectionState(client)
    await hydrateDashboardState(session)
    if (session.disposed) {
      throw new Error('Devframe Dashboard 连接在初始化期间断开。')
    }
    consumeOtpFromUrl()
    reconnectAttempt = 0
  }
  catch (error) {
    const unauthorized = client.status === 'unauthorized'
    if (session) {
      disposeSession(session, true)
    }
    else {
      client.close?.()
    }
    if (unauthorized && !(error instanceof DashboardAuthorizationError)) {
      throw new DashboardAuthorizationError('Devframe 未授权当前 Dashboard 连接。', { cause: error })
    }
    throw error
  }
}

export async function connectDashboardDevframe() {
  if (activeSession?.client.status === 'connected' && !activeSession.disposed) {
    return
  }
  if (connectPromise) {
    return await connectPromise
  }

  clearReconnectTimer()
  dashboardConnectionStatus.value = 'connecting'
  connectPromise = initializeDashboardDevframe()
  try {
    await connectPromise
  }
  catch (error) {
    const unauthorized = error instanceof DashboardAuthorizationError
    dashboardConnectionStatus.value = unauthorized ? 'unauthorized' : 'error'
    dashboardConnectionError.value = error instanceof Error ? error : new Error(String(error))
    if (!unauthorized) {
      scheduleReconnect()
    }
    throw dashboardConnectionError.value
  }
  finally {
    connectPromise = undefined
  }
}

reconnectDashboard = connectDashboardDevframe

export async function readDashboardFileContent(kind: DashboardFileKind, filePath: string) {
  await connectDashboardDevframe()
  const session = activeSession
  if (!session || session.disposed || session.client.status !== 'connected') {
    throw new Error('Devframe Dashboard 当前未连接。')
  }
  return await session.dashboard.rpc.call('read-dashboard-file', {
    kind,
    path: filePath,
  })
}

export type {
  DashboardAnalyzePayloadDescriptor,
  DashboardAnalyzeSnapshot,
  DashboardFileContent,
  DashboardFileKind,
}
