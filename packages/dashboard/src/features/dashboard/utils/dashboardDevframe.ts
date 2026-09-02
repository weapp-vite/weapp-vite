import type {} from 'devframe'
import type { DevframeConnectionStatus, DevframeRpcClient } from 'devframe/client'
import type { AnalyzeSubpackagesResult, DashboardRuntimeEvent } from '../types'
import { connectDevframe } from 'devframe/client'
import { shallowRef } from 'vue'
import { normalizeRuntimeEvents } from './runtimeEvents'

const DEVFRAME_ID = 'weapp-vite'

export interface DashboardAnalyzeSnapshot {
  current: AnalyzeSubpackagesResult
  previous: AnalyzeSubpackagesResult | null
}

export interface DashboardDevframeSharedState {
  revision: number
  runtimeEvents: DashboardRuntimeEvent[]
}

export interface DashboardFileContent {
  content: string
  kind: DashboardFileKind
  language: string
  path: string
  size: number
}

export type DashboardFileKind = 'artifact' | 'source'

declare module 'devframe' {
  interface DevframeRpcServerFunctions {
    'weapp-vite:get-analyze-state': () => DashboardAnalyzeSnapshot
    'weapp-vite:read-dashboard-file': (input: { kind: DashboardFileKind, path: string }) => Promise<DashboardFileContent>
  }

  interface DevframeRpcSharedStates {
    'weapp-vite:dashboard': DashboardDevframeSharedState
  }
}

export const dashboardAnalyzeSnapshot = shallowRef<DashboardAnalyzeSnapshot | null>(null)
export const dashboardConnectionError = shallowRef<Error | null>(null)
export const dashboardConnectionStatus = shallowRef<DevframeConnectionStatus>('connecting')
export const dashboardRuntimeEvents = shallowRef<DashboardRuntimeEvent[]>([])

let clientPromise: Promise<DevframeRpcClient> | undefined
let connected = false
let refreshPromise: Promise<void> | undefined
let refreshPending = false

async function getDashboardDevframeClient() {
  clientPromise ??= connectDevframe({ baseURL: '/__weapp-vite/' })
  try {
    return await clientPromise
  }
  catch (error) {
    clientPromise = undefined
    throw error
  }
}

async function getTrustedDashboardDevframeClient() {
  const client = await getDashboardDevframeClient()
  if (!await client.ensureTrusted()) {
    throw new Error('Devframe 未授权当前 Dashboard 连接。')
  }
  return client
}

async function refreshAnalyzeSnapshot(client: DevframeRpcClient) {
  if (refreshPromise) {
    refreshPending = true
    return await refreshPromise
  }

  refreshPromise = (async () => {
    do {
      refreshPending = false
      dashboardAnalyzeSnapshot.value = await client.call('weapp-vite:get-analyze-state')
    } while (refreshPending)
  })()

  try {
    await refreshPromise
  }
  finally {
    refreshPromise = undefined
  }
}

function syncConnectionState(client: DevframeRpcClient) {
  dashboardConnectionStatus.value = client.status
  dashboardConnectionError.value = client.connectionError
}

export async function connectDashboardDevframe() {
  if (connected) {
    return
  }

  try {
    const client = await getTrustedDashboardDevframeClient()
    const dashboard = client.scope(DEVFRAME_ID)
    const sharedState = await dashboard.rpc.sharedState('dashboard')
    let revision = sharedState.value().revision

    connected = true
    syncConnectionState(client)
    dashboardRuntimeEvents.value = normalizeRuntimeEvents(sharedState.value().runtimeEvents)
    await refreshAnalyzeSnapshot(client)

    sharedState.on('updated', (state) => {
      dashboardRuntimeEvents.value = normalizeRuntimeEvents(state.runtimeEvents)
      if (state.revision === revision) {
        return
      }
      revision = state.revision
      void refreshAnalyzeSnapshot(client)
    })
    client.events.on('connection:status', () => {
      syncConnectionState(client)
    })
    client.events.on('connection:error', (error) => {
      dashboardConnectionError.value = error
    })
  }
  catch (error) {
    dashboardConnectionStatus.value = 'error'
    dashboardConnectionError.value = error instanceof Error ? error : new Error(String(error))
    throw dashboardConnectionError.value
  }
}

export async function readDashboardFileContent(kind: DashboardFileKind, filePath: string) {
  const client = await getTrustedDashboardDevframeClient()
  return await client.call('weapp-vite:read-dashboard-file', {
    kind,
    path: filePath,
  })
}
