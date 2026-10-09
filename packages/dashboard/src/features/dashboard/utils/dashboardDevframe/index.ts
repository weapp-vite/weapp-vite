import type {
  DevframeConnectionStatus,
  DevframeRpcClient,
  DevframeScopedClientContext,
} from 'devframe/client'
import type {
  DashboardAuthorizeInvestigationRequest,
  DashboardCreateInvestigationRequest,
  DashboardInvestigation,
  DashboardInvestigationRequest,
  DashboardInvestigationsState,
  DashboardReportIdentity,
  DashboardVerifyInvestigationRequest,
} from 'weapp-vite/dashboard'
import type { DashboardRuntimeEvent } from '../../types'
import type {
  DashboardAnalyzePayloadDescriptor,
  DashboardAnalyzeSnapshot,
  DashboardDevframeState,
  DashboardFileContent,
  DashboardFileKind,
  DashboardFileRequest,
} from './payload'
import { connectDevframe, consumeOtpFromUrl } from 'devframe/client'
import { shallowRef } from 'vue'
import { normalizeRuntimeEvents } from '../runtimeEvents'
import { readDashboardAnalyzeSnapshot } from './payload'

const DEVFRAME_ID = 'weapp-vite' as const
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
  controllerId?: string
  reportHash?: string
}

class DashboardAuthorizationError extends Error {
  override name = 'DashboardAuthorizationError'
}

export const dashboardAnalyzeSnapshot = shallowRef<DashboardAnalyzeSnapshot | null>(null)
/** 当前会话已完成水合且仍与宿主同步的 Analyze revision；刷新期间为空。 */
export const dashboardAnalyzeRevision = shallowRef<number | null>(null)
/** 只有当前报告完成水合后才可用于创建调查或授权。 */
export const dashboardReportIdentity = shallowRef<DashboardReportIdentity | null>(null)
/** 调查元数据由宿主单独递增版本，不依赖 Analyze revision。 */
export const dashboardInvestigations = shallowRef<DashboardInvestigationsState>({ version: 0, items: [] })
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
    dashboardAnalyzeRevision.value = null
    dashboardReportIdentity.value = null
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

function isSessionActive(session: DashboardConnectionSession) {
  return activeSession === session && !session.disposed
}

function isSameReport(left: DashboardReportIdentity | null, right: DashboardReportIdentity) {
  return left?.sessionId === right.sessionId
    && left.revision === right.revision
    && left.reportHash === right.reportHash
}

function syncDashboardMetadata(session: DashboardConnectionSession, state: DashboardDevframeState) {
  if (session.controllerId !== state.sessionId) {
    session.controllerId = state.sessionId
    session.revision = -1
    session.reportHash = undefined
    dashboardInvestigations.value = state.investigations
  }
  else if (state.investigations.version >= dashboardInvestigations.value.version) {
    dashboardInvestigations.value = state.investigations
  }
  dashboardRuntimeEvents.value = normalizeRuntimeEvents(state.runtimeEvents)
  if (state.revision !== session.revision || state.analyze.current.hash !== session.reportHash) {
    dashboardAnalyzeRevision.value = null
    dashboardReportIdentity.value = null
  }
}

async function hydrateDashboardState(
  session: DashboardConnectionSession,
  initialState?: DashboardDevframeState,
) {
  if (!isSessionActive(session)) {
    return
  }
  if (initialState) {
    if (initialState.sessionId === session.controllerId && initialState.revision < session.revision) {
      return
    }
    syncDashboardMetadata(session, initialState)
  }
  if (session.refreshPromise) {
    if (initialState) {
      session.pendingState = initialState
    }
    return await session.refreshPromise
  }

  session.pendingState = initialState
  session.refreshPromise = (async () => {
    do {
      let state = session.pendingState
      session.pendingState = undefined
      if (!state) {
        state = await session.dashboard.rpc.call('get-dashboard-state')
        if (!isSessionActive(session)) {
          return
        }
        if (session.pendingState) {
          continue
        }
      }
      syncDashboardMetadata(session, state)
      if (state.revision === session.revision && state.analyze.current.hash === session.reportHash && dashboardAnalyzeSnapshot.value) {
        continue
      }
      dashboardAnalyzeRevision.value = null
      dashboardReportIdentity.value = null

      let snapshot: DashboardAnalyzeSnapshot
      try {
        snapshot = await readDashboardAnalyzeSnapshot(session.dashboard.rpc, state.analyze, state.revision)
      }
      catch (error) {
        if (!isSessionActive(session)) {
          return
        }
        if (!isStaleAnalyzeRevisionError(error)) {
          throw error
        }
        const latest = await session.dashboard.rpc.call('get-dashboard-state')
        if (!isSessionActive(session)) {
          return
        }
        session.pendingState ??= latest
        continue
      }
      if (!isSessionActive(session)) {
        return
      }
      if (session.pendingState) {
        continue
      }
      session.revision = state.revision
      session.reportHash = state.analyze.current.hash
      dashboardAnalyzeSnapshot.value = snapshot
      dashboardAnalyzeRevision.value = state.revision
      dashboardReportIdentity.value = {
        sessionId: state.sessionId,
        revision: state.revision,
        reportHash: state.analyze.current.hash,
      }
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
    callTimeout: 30_000,
    webmcp: false,
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
  dashboardAnalyzeRevision.value = null
  dashboardReportIdentity.value = null
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

export async function readDashboardFileContent(
  kind: DashboardFileKind,
  filePath: string,
  revision: number,
) {
  await connectDashboardDevframe()
  const session = activeSession
  if (!session || session.disposed || session.client.status !== 'connected') {
    throw new Error('Devframe Dashboard 当前未连接。')
  }
  if (session.revision !== revision || dashboardAnalyzeRevision.value !== revision) {
    throw new Error('Analyze revision 已变化，请刷新当前 Dashboard 状态。')
  }
  const controllerId = session.controllerId
  const reportHash = session.reportHash
  const content = await session.dashboard.rpc.call('read-dashboard-file', {
    kind,
    path: filePath,
    revision,
  })
  if (activeSession !== session || session.disposed || session.client.status !== 'connected' || session.controllerId !== controllerId) {
    throw new Error('Devframe Dashboard 文件读取期间连接已变化。')
  }
  if (session.revision !== revision || dashboardAnalyzeRevision.value !== revision || session.reportHash !== reportHash) {
    throw new Error('Analyze revision 已变化，请刷新当前 Dashboard 状态。')
  }
  return content
}

/** 浏览器变更不自动重连或重放，避免将旧页面意图发送到新会话。 */
function requireInvestigationSession(report?: DashboardReportIdentity, input?: DashboardInvestigationRequest) {
  const session = activeSession
  const current = dashboardReportIdentity.value
  if (!session || session.disposed || session.client.status !== 'connected' || !current) {
    throw new Error('宿主未连接或报告仍在同步。输入已保留，请连接后重试。')
  }
  if (report && !isSameReport(current, report)) {
    throw new Error('调查绑定的报告已变化；请保留原调查，明确创建新草稿。')
  }
  if (input) {
    const task = dashboardInvestigations.value.items.find(item => item.id === input.id)
    if (!task || task.report.sessionId !== current.sessionId || task.version !== input.version) {
      throw new Error('调查状态已变化，请查看最新任务后重新操作。')
    }
  }
  return session
}

async function receiveInvestigationMutation(
  session: DashboardConnectionSession,
  response: Promise<DashboardInvestigation>,
) {
  const controllerId = session.controllerId
  const result = await response
  if (!isSessionActive(session) || session.client.status !== 'connected' || session.controllerId !== controllerId) {
    throw new Error('调查请求期间连接已变化；请检查当前任务列表，勿将旧响应视为本次会话结果。')
  }
  // 以宿主列表版本为准，不把单条响应拼成缺少全局版本的乐观状态。
  try {
    await hydrateDashboardState(session)
  }
  catch (error) {
    handleRefreshFailure(session, error)
    throw error
  }
  if (!isSessionActive(session) || session.client.status !== 'connected' || session.controllerId !== controllerId) {
    throw new Error('调查同步期间连接已变化；输入已保留，请重新连接后检查任务列表。')
  }
  return result
}

export async function createDashboardInvestigation(input: DashboardCreateInvestigationRequest): Promise<DashboardInvestigation> {
  const session = requireInvestigationSession(input.report)
  return await receiveInvestigationMutation(session, session.dashboard.rpc.call('create-investigation', input))
}

export async function cancelDashboardInvestigation(input: DashboardInvestigationRequest): Promise<DashboardInvestigation> {
  const session = requireInvestigationSession(undefined, input)
  return await receiveInvestigationMutation(session, session.dashboard.rpc.call('cancel-investigation', input))
}

export async function authorizeDashboardInvestigation(input: DashboardAuthorizeInvestigationRequest): Promise<DashboardInvestigation> {
  const session = requireInvestigationSession(undefined, input)
  const task = dashboardInvestigations.value.items.find(item => item.id === input.id)!
  if (!isSameReport(dashboardReportIdentity.value, task.report) || task.status !== 'proposed' || task.proposal?.id !== input.proposalId) {
    throw new Error('报告或提案已变化，请重新查看提案；旧授权意图未发送。')
  }
  return await receiveInvestigationMutation(session, session.dashboard.rpc.call('authorize-investigation', input))
}

export async function verifyDashboardInvestigation(input: DashboardVerifyInvestigationRequest): Promise<DashboardInvestigation> {
  const session = requireInvestigationSession(input.report, input)
  return await receiveInvestigationMutation(session, session.dashboard.rpc.call('verify-investigation', input))
}

export type {
  DashboardAnalyzePayloadDescriptor,
  DashboardAnalyzeSnapshot,
  DashboardFileContent,
  DashboardFileKind,
  DashboardFileRequest,
}
