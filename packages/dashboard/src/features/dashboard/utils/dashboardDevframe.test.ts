import type { DevframeConnectionStatus, DevframeRpcClient } from 'devframe/client'
import type { Mock } from 'vitest'
import type { AnalyzeSubpackagesResult, DashboardRuntimeEvent } from '../types'
import { afterEach, describe, expect, it, vi } from 'vitest'

const connectDevframeMock = vi.hoisted(() => vi.fn())
const consumeOtpFromUrlMock = vi.hoisted(() => vi.fn())

vi.mock('devframe/client', () => ({
  connectDevframe: connectDevframeMock,
  consumeOtpFromUrl: consumeOtpFromUrlMock,
}))

interface DashboardState {
  analyze: {
    current: PayloadDescriptor
    previous: PayloadDescriptor | null
  }
  revision: number
  runtimeEvents: DashboardRuntimeEvent[]
}

interface PayloadDescriptor {
  characters: number
  hash: string
  pages: number
}

interface FakeClientControl {
  call: Mock
  client: DevframeRpcClient
  emitDashboardState: () => void
  emitStatus: (status: DevframeConnectionStatus, error?: Error) => void
  setSnapshot: (
    current: AnalyzeSubpackagesResult,
    previous: AnalyzeSubpackagesResult | null,
    revision: number,
    events?: DashboardRuntimeEvent[],
  ) => void
}

function createResult(label: string): AnalyzeSubpackagesResult {
  return {
    packages: label
      ? [{ id: label, label, type: 'main', files: [] }]
      : [],
    modules: [],
    subPackages: [],
  }
}

function createRuntimeEvent(id: string): DashboardRuntimeEvent {
  return {
    id,
    kind: 'build',
    level: 'info',
    title: id,
    detail: id,
    timestamp: '10:00:00',
    source: 'weapp-vite',
  }
}

function serializePayload(result: AnalyzeSubpackagesResult) {
  const value = JSON.stringify(result)
  const pageCharacters = 40
  return {
    descriptor: {
      characters: value.length,
      hash: `${value.length}:${result.packages[0]?.id ?? 'empty'}`,
      pages: Math.max(1, Math.ceil(value.length / pageCharacters)),
    },
    pageCharacters,
    value,
  }
}

function createFakeClient(
  initialCurrent: AnalyzeSubpackagesResult,
  initialPrevious: AnalyzeSubpackagesResult | null = null,
): FakeClientControl {
  let status: DevframeConnectionStatus = 'connected'
  let connectionError: Error | null = null
  let current = serializePayload(initialCurrent)
  let previous = initialPrevious ? serializePayload(initialPrevious) : null
  let revision = 0
  let runtimeEvents = [createRuntimeEvent('initial')]
  let dashboardStateHandler: ((state: DashboardState) => void) | undefined
  const statusListeners = new Set<(status: DevframeConnectionStatus, previous: DevframeConnectionStatus) => void>()
  const errorListeners = new Set<(error: Error) => void>()

  const getState = (): DashboardState => ({
    analyze: {
      current: current.descriptor,
      previous: previous?.descriptor ?? null,
    },
    revision,
    runtimeEvents,
  })
  const call = vi.fn(async (method: unknown, input?: unknown) => {
    if (method === 'get-dashboard-state') {
      return getState()
    }
    if (method === 'get-analyze-page') {
      if (!input || typeof input !== 'object' || !('target' in input) || !('index' in input)) {
        throw new Error('invalid page request')
      }
      const target = input.target
      const index = input.index
      const payload = target === 'current' ? current : previous
      if (!payload || typeof index !== 'number') {
        throw new Error('missing page')
      }
      return {
        content: payload.value.slice(index * payload.pageCharacters, (index + 1) * payload.pageCharacters),
        descriptor: payload.descriptor,
        index,
        revision,
        target,
      }
    }
    if (method === 'read-dashboard-file') {
      return {
        kind: 'source',
        path: 'src/app.ts',
        language: 'typescript',
        size: 20,
        content: 'export const app = 1',
      }
    }
    throw new Error(`Unexpected RPC method: ${String(method)}`)
  })
  const client = {
    get connectionError() {
      return connectionError
    },
    get status() {
      return status
    },
    close: vi.fn(),
    ensureTrusted: vi.fn(async () => true),
    events: {
      on: vi.fn((event: string, listener: unknown) => {
        if (event === 'connection:status' && typeof listener === 'function') {
          const statusListener = listener as (next: DevframeConnectionStatus, previous: DevframeConnectionStatus) => void
          statusListeners.add(statusListener)
          return () => statusListeners.delete(statusListener)
        }
        if (event === 'connection:error' && typeof listener === 'function') {
          const errorListener = listener as (error: Error) => void
          errorListeners.add(errorListener)
          return () => errorListeners.delete(errorListener)
        }
        return () => {}
      }),
    },
    scope: vi.fn(() => ({
      rpc: {
        call,
        register: vi.fn((definition: unknown) => {
          if (
            definition
            && typeof definition === 'object'
            && 'name' in definition
            && definition.name === 'dashboard-state-updated'
            && 'handler' in definition
            && typeof definition.handler === 'function'
          ) {
            dashboardStateHandler = definition.handler as (state: DashboardState) => void
          }
        }),
      },
    })),
  } as unknown as DevframeRpcClient

  return {
    call,
    client,
    emitDashboardState() {
      dashboardStateHandler?.(getState())
    },
    emitStatus(nextStatus, error) {
      const previousStatus = status
      status = nextStatus
      connectionError = error ?? null
      for (const listener of statusListeners) {
        listener(nextStatus, previousStatus)
      }
      if (error) {
        for (const listener of errorListeners) {
          listener(error)
        }
      }
    },
    setSnapshot(nextCurrent, nextPrevious, nextRevision, events = runtimeEvents) {
      current = serializePayload(nextCurrent)
      previous = nextPrevious ? serializePayload(nextPrevious) : null
      revision = nextRevision
      runtimeEvents = events
    },
  }
}

async function loadDashboardTransport() {
  // 每个用例必须重新加载模块，以隔离模块级连接和重连状态。
  return await import('./dashboardDevframe')
}

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.resetModules()
  vi.clearAllMocks()
})

describe('dashboard Devframe client', () => {
  it('hydrates paged Analyze data and refreshes it on a state event', async () => {
    const older = createResult('older')
    const initial = createResult('initial')
    const next = createResult('next')
    const control = createFakeClient(initial, older)
    connectDevframeMock.mockResolvedValue(control.client)

    const transport = await loadDashboardTransport()
    await transport.connectDashboardDevframe()
    expect(transport.dashboardAnalyzeSnapshot.value).toEqual({ current: initial, previous: older })
    expect(consumeOtpFromUrlMock).toHaveBeenCalledTimes(1)
    const previousPageCallsBeforeUpdate = control.call.mock.calls.filter(([method, input]) => (
      method === 'get-analyze-page' && input?.target === 'previous'
    )).length

    control.setSnapshot(next, initial, 1, [createRuntimeEvent('next')])
    control.emitDashboardState()
    await vi.waitFor(() => {
      expect(transport.dashboardAnalyzeSnapshot.value).toEqual({ current: next, previous: initial })
    })
    expect(transport.dashboardRuntimeEvents.value).toEqual([
      expect.objectContaining({ id: 'next' }),
    ])
    expect(control.call.mock.calls.filter(([method]) => method === 'get-analyze-page').length).toBeGreaterThan(1)
    expect(control.call.mock.calls.filter(([method, input]) => (
      method === 'get-analyze-page' && input?.target === 'previous'
    ))).toHaveLength(previousPageCallsBeforeUpdate)
  })

  it('restarts pagination from the latest state after a stale revision', async () => {
    const initial = createResult('initial')
    const stale = createResult('stale')
    const latest = createResult('latest')
    const control = createFakeClient(initial)
    connectDevframeMock.mockResolvedValue(control.client)

    const transport = await loadDashboardTransport()
    await transport.connectDashboardDevframe()
    control.setSnapshot(stale, initial, 1)
    control.call.mockImplementationOnce(async () => {
      control.setSnapshot(latest, stale, 2)
      throw new Error('Analyze revision 已变化，请重新获取 Dashboard 状态。')
    })
    control.emitDashboardState()

    await vi.waitFor(() => {
      expect(transport.dashboardAnalyzeSnapshot.value).toEqual({
        current: latest,
        previous: stale,
      })
    })
    expect(control.call.mock.calls.filter(([method]) => method === 'get-dashboard-state')).toHaveLength(2)
  })

  it('reconnects and rehydrates after a successful connection disconnects', async () => {
    vi.useFakeTimers()
    const first = createFakeClient(createResult('first'))
    const second = createFakeClient(createResult('second'))
    connectDevframeMock
      .mockResolvedValueOnce(first.client)
      .mockResolvedValueOnce(second.client)

    const transport = await loadDashboardTransport()
    await transport.connectDashboardDevframe()
    first.emitStatus('disconnected')
    expect(transport.dashboardConnectionStatus.value).toBe('disconnected')

    await vi.advanceTimersByTimeAsync(250)
    await vi.waitFor(() => {
      expect(connectDevframeMock).toHaveBeenCalledTimes(2)
      expect(transport.dashboardAnalyzeSnapshot.value?.current.packages[0]?.id).toBe('second')
      expect(transport.dashboardConnectionStatus.value).toBe('connected')
    })
  })

  it('reconnects after a post-connect pagination failure', async () => {
    vi.useFakeTimers()
    const first = createFakeClient(createResult('first'))
    const recovered = createFakeClient(createResult('recovered'))
    connectDevframeMock
      .mockResolvedValueOnce(first.client)
      .mockResolvedValueOnce(recovered.client)

    const transport = await loadDashboardTransport()
    await transport.connectDashboardDevframe()
    first.setSnapshot(createResult('broken'), createResult('first'), 1)
    first.call.mockRejectedValueOnce(new Error('refresh failed'))
    first.emitDashboardState()
    await vi.advanceTimersByTimeAsync(0)

    expect(transport.dashboardConnectionStatus.value).toBe('error')
    expect(transport.dashboardConnectionError.value?.message).toBe('refresh failed')
    expect(first.client.close).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(250)
    await vi.waitFor(() => {
      expect(connectDevframeMock).toHaveBeenCalledTimes(2)
      expect(transport.dashboardAnalyzeSnapshot.value?.current.packages[0]?.id).toBe('recovered')
      expect(transport.dashboardConnectionStatus.value).toBe('connected')
      expect(transport.dashboardConnectionError.value).toBeNull()
    })
  })

  it('closes an established client when authorization is revoked', async () => {
    vi.useFakeTimers()
    const control = createFakeClient(createResult('authorized'))
    connectDevframeMock.mockResolvedValue(control.client)

    const transport = await loadDashboardTransport()
    await transport.connectDashboardDevframe()
    control.emitStatus('unauthorized', new Error('token revoked'))

    expect(transport.dashboardConnectionStatus.value).toBe('unauthorized')
    expect(control.client.close).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(connectDevframeMock).toHaveBeenCalledTimes(1)
  })

  it('keeps an authentication refusal terminal without reconnecting', async () => {
    vi.useFakeTimers()
    const control = createFakeClient(createResult('unauthorized'))
    vi.mocked(control.client.ensureTrusted).mockResolvedValue(false)
    connectDevframeMock.mockResolvedValue(control.client)

    const transport = await loadDashboardTransport()
    await expect(transport.connectDashboardDevframe()).rejects.toThrow('未授权')
    expect(transport.dashboardConnectionStatus.value).toBe('unauthorized')

    await vi.advanceTimersByTimeAsync(10_000)
    expect(connectDevframeMock).toHaveBeenCalledTimes(1)
    expect(transport.dashboardConnectionStatus.value).toBe('unauthorized')
  })

  it('allows an immediate retry after the initial state query fails', async () => {
    const failed = createFakeClient(createResult('failed'))
    failed.call.mockRejectedValueOnce(new Error('initial query failed'))
    const recovered = createFakeClient(createResult('recovered'))
    connectDevframeMock
      .mockResolvedValueOnce(failed.client)
      .mockResolvedValueOnce(recovered.client)

    const transport = await loadDashboardTransport()
    await expect(transport.connectDashboardDevframe()).rejects.toThrow('initial query failed')
    await expect(transport.connectDashboardDevframe()).resolves.toBeUndefined()

    expect(connectDevframeMock).toHaveBeenCalledTimes(2)
    expect(transport.dashboardAnalyzeSnapshot.value?.current.packages[0]?.id).toBe('recovered')
    expect(transport.dashboardConnectionStatus.value).toBe('connected')
  })

  it('reads source content through the active paged Devframe session', async () => {
    const control = createFakeClient(createResult('source'))
    connectDevframeMock.mockResolvedValue(control.client)

    const transport = await loadDashboardTransport()
    await expect(transport.readDashboardFileContent('source', 'src/app.ts')).resolves.toEqual({
      kind: 'source',
      path: 'src/app.ts',
      language: 'typescript',
      size: 20,
      content: 'export const app = 1',
    })
    expect(control.call).toHaveBeenCalledWith('read-dashboard-file', {
      kind: 'source',
      path: 'src/app.ts',
    })
  })
})
