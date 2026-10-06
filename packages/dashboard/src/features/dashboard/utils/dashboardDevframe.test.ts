import type { DevframeConnectionStatus, DevframeRpcClient } from 'devframe/client'
import type { Mock } from 'vitest'
import type {
  DashboardDevframeState,
  DashboardInvestigation,
  DashboardInvestigationsState,
  DashboardReportIdentity,
  DashboardRuntimeEvent,
} from 'weapp-vite/dashboard'
import type { AnalyzeSubpackagesResult } from '../types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { watch } from 'vue'

const connectDevframeMock = vi.hoisted(() => vi.fn())
const consumeOtpFromUrlMock = vi.hoisted(() => vi.fn())

vi.mock('devframe/client', () => ({
  connectDevframe: connectDevframeMock,
  consumeOtpFromUrl: consumeOtpFromUrlMock,
}))

type DashboardState = DashboardDevframeState

interface FakeClientControl {
  call: Mock
  client: DevframeRpcClient
  emitDashboardState: (state?: DashboardState) => void
  emitStatus: (status: DevframeConnectionStatus, error?: Error) => void
  setInvestigations: (state: DashboardInvestigationsState) => void
  setSessionId: (id: string) => void
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
    occurredAt: '2026-01-01T10:00:00.000Z',
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
  let sessionId = `session:${initialCurrent.packages[0]?.id ?? 'empty'}`
  let investigations: DashboardInvestigationsState = { version: 0, items: [] }
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
    sessionId,
    investigations,
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
    close: vi.fn(() => {
      status = 'disconnected'
    }),
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
    emitDashboardState(state) {
      dashboardStateHandler?.(state ?? getState())
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
    setInvestigations(state) {
      investigations = state
    },
    setSessionId(id) {
      sessionId = id
    },
    setSnapshot(nextCurrent, nextPrevious, nextRevision, events = runtimeEvents) {
      current = serializePayload(nextCurrent)
      previous = nextPrevious ? serializePayload(nextPrevious) : null
      revision = nextRevision
      runtimeEvents = events
    },
  }
}

function createInvestigation(report: DashboardReportIdentity, id = 'task-1'): DashboardInvestigation {
  return {
    id,
    version: 1,
    createdAt: '2026-10-06T00:00:00.000Z',
    updatedAt: '2026-10-06T00:00:00.000Z',
    report,
    target: { kind: 'package', packageId: 'initial' },
    question: 'Explain the measured package size',
    evidence: { label: 'initial', rawBytes: null, gzipBytes: null, brotliBytes: null, attributedBytes: null, sourceBytes: null },
    status: 'submitted',
    agent: null,
    proposal: null,
    authorization: null,
    receipt: null,
    verification: null,
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
    expect(transport.dashboardAnalyzeRevision.value).toBe(0)
    expect(consumeOtpFromUrlMock).toHaveBeenCalledTimes(1)
    const previousPageCallsBeforeUpdate = control.call.mock.calls.filter(([method, input]) => (
      method === 'get-analyze-page' && input?.target === 'previous'
    )).length

    control.setSnapshot(next, initial, 1, [createRuntimeEvent('next')])
    control.emitDashboardState()
    await vi.waitFor(() => {
      expect(transport.dashboardAnalyzeSnapshot.value).toEqual({ current: next, previous: initial })
      expect(transport.dashboardAnalyzeRevision.value).toBe(1)
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
    const ready = Promise.withResolvers<void>()
    const readState = second.call.getMockImplementation()!
    second.call.mockImplementationOnce(async (...args) => {
      await ready.promise
      return readState(...args)
    })
    connectDevframeMock
      .mockResolvedValueOnce(first.client)
      .mockResolvedValueOnce(second.client)

    const transport = await loadDashboardTransport()
    const hydratedRevisions: Array<number | null> = []
    const stopRevisionWatch = watch(
      transport.dashboardAnalyzeRevision,
      revision => hydratedRevisions.push(revision),
      { flush: 'sync' },
    )
    await transport.connectDashboardDevframe()
    first.emitStatus('disconnected')
    expect(transport.dashboardConnectionStatus.value).toBe('disconnected')

    await vi.advanceTimersByTimeAsync(250)
    expect(transport.dashboardConnectionStatus.value).toBe('connected')
    expect(transport.dashboardAnalyzeSnapshot.value?.current.packages[0]?.id).toBe('first')
    expect(transport.dashboardAnalyzeRevision.value).toBeNull()
    ready.resolve()
    await vi.waitFor(() => {
      expect(connectDevframeMock).toHaveBeenCalledTimes(2)
      expect(transport.dashboardAnalyzeSnapshot.value?.current.packages[0]?.id).toBe('second')
      expect(transport.dashboardConnectionStatus.value).toBe('connected')
    })
    expect(hydratedRevisions).toEqual([0, null, 0])
    stopRevisionWatch()
  })

  it('withdraws the readable revision while an announced report is still hydrating', async () => {
    const initial = createResult('initial')
    const control = createFakeClient(initial)
    connectDevframeMock.mockResolvedValue(control.client)
    const transport = await loadDashboardTransport()
    await transport.connectDashboardDevframe()

    const ready = Promise.withResolvers<void>()
    const readPage = control.call.getMockImplementation()!
    control.call.mockImplementationOnce(async (...args) => {
      await ready.promise
      return readPage(...args)
    })
    control.setSnapshot(createResult('next'), initial, 1)
    control.emitDashboardState()

    expect(transport.dashboardAnalyzeSnapshot.value?.current).toEqual(initial)
    expect(transport.dashboardAnalyzeRevision.value).toBeNull()
    await expect(transport.readDashboardFileContent('source', 'src/app.ts', 0)).rejects.toThrow('Analyze revision 已变化')
    ready.resolve()
    await vi.waitFor(() => {
      expect(transport.dashboardAnalyzeRevision.value).toBe(1)
      expect(transport.dashboardAnalyzeSnapshot.value?.current.packages[0]?.id).toBe('next')
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

  it('closes a cancelled authorization when ensureTrusted times out without reconnecting', async () => {
    vi.useFakeTimers()
    const control = createFakeClient(createResult('unauthorized'))
    const timeoutError = new Error('Timed out waiting for trust')
    vi.mocked(control.client.ensureTrusted).mockImplementation(() => {
      const { promise, reject } = Promise.withResolvers<boolean>()
      setTimeout(reject, 60_000, timeoutError)
      return promise
    })
    connectDevframeMock.mockResolvedValue(control.client)

    const transport = await loadDashboardTransport()
    const rejection = expect(transport.connectDashboardDevframe()).rejects.toMatchObject({
      name: 'DashboardAuthorizationError',
      cause: timeoutError,
    })
    await vi.advanceTimersByTimeAsync(0)
    control.emitStatus('unauthorized')
    expect(control.client.close).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(60_000)
    await rejection
    expect(control.client.close).toHaveBeenCalledTimes(1)
    expect(transport.dashboardConnectionStatus.value).toBe('unauthorized')
    expect(transport.dashboardAnalyzeSnapshot.value).toBeNull()

    control.emitStatus('connected')
    control.emitDashboardState()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(connectDevframeMock).toHaveBeenCalledTimes(1)
    expect(transport.dashboardConnectionStatus.value).toBe('unauthorized')
    expect(transport.dashboardAnalyzeSnapshot.value).toBeNull()
  })

  it('allows OTP authorization to recover an initially unauthorized connection', async () => {
    vi.useFakeTimers()
    const authorized = createResult('authorized')
    const control = createFakeClient(authorized)
    vi.mocked(control.client.ensureTrusted).mockImplementation(() => new Promise((resolve) => {
      control.emitStatus('unauthorized')
      setTimeout(() => {
        control.emitStatus('connected')
        resolve(true)
      }, 100)
    }))
    connectDevframeMock.mockResolvedValue(control.client)

    const transport = await loadDashboardTransport()
    const connection = transport.connectDashboardDevframe()
    await vi.advanceTimersByTimeAsync(0)
    expect(control.client.close).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(100)
    await connection
    expect(transport.dashboardAnalyzeSnapshot.value?.current).toEqual(authorized)
    expect(transport.dashboardConnectionStatus.value).toBe('connected')
    expect(control.client.close).not.toHaveBeenCalled()
    expect(connectDevframeMock).toHaveBeenCalledTimes(1)
  })

  it('closes and retries a transport failure while waiting for trust', async () => {
    vi.useFakeTimers()
    const failed = createFakeClient(createResult('failed'))
    const recovered = createFakeClient(createResult('recovered'))
    const transportError = new Error('connection lost')
    vi.mocked(failed.client.ensureTrusted).mockImplementation(async () => {
      failed.emitStatus('disconnected', transportError)
      throw transportError
    })
    connectDevframeMock
      .mockResolvedValueOnce(failed.client)
      .mockResolvedValueOnce(recovered.client)

    const transport = await loadDashboardTransport()
    await expect(transport.connectDashboardDevframe()).rejects.toBe(transportError)
    expect(failed.client.close).toHaveBeenCalledTimes(1)
    expect(transport.dashboardConnectionStatus.value).toBe('error')

    await vi.advanceTimersByTimeAsync(250)
    expect(connectDevframeMock).toHaveBeenCalledTimes(2)
    expect(transport.dashboardAnalyzeSnapshot.value?.current.packages[0]?.id).toBe('recovered')
    expect(transport.dashboardConnectionStatus.value).toBe('connected')
    expect(transport.dashboardConnectionError.value).toBeNull()
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

    expect(failed.client.close).toHaveBeenCalledTimes(1)
    failed.emitStatus('connected', new Error('stale connection event'))
    failed.emitDashboardState()
    await vi.waitFor(() => {
      expect(transport.dashboardConnectionError.value).toBeNull()
    })

    expect(connectDevframeMock).toHaveBeenCalledTimes(2)
    expect(transport.dashboardAnalyzeSnapshot.value?.current.packages[0]?.id).toBe('recovered')
    expect(transport.dashboardConnectionStatus.value).toBe('connected')
  })

  it('reads source content through the active paged Devframe session', async () => {
    const control = createFakeClient(createResult('source'))
    connectDevframeMock.mockResolvedValue(control.client)

    const transport = await loadDashboardTransport()
    await expect(transport.readDashboardFileContent('source', 'src/app.ts', 0)).resolves.toEqual({
      kind: 'source',
      path: 'src/app.ts',
      language: 'typescript',
      size: 20,
      content: 'export const app = 1',
    })
    expect(control.call).toHaveBeenCalledWith('read-dashboard-file', {
      kind: 'source',
      path: 'src/app.ts',
      revision: 0,
    })
  })

  it('rejects a file response after the displayed analysis revision changes', async () => {
    const initial = createResult('initial')
    const control = createFakeClient(initial)
    connectDevframeMock.mockResolvedValue(control.client)
    const response = {
      kind: 'source' as const,
      path: 'src/app.ts',
      language: 'typescript',
      size: 20,
      content: 'export const app = 1',
    }
    const deferred = Promise.withResolvers<typeof response>()

    const transport = await loadDashboardTransport()
    await transport.connectDashboardDevframe()
    control.call.mockImplementationOnce(async () => await deferred.promise)
    const pendingRead = transport.readDashboardFileContent('source', 'src/app.ts', 0)
    await vi.waitFor(() => {
      expect(control.call).toHaveBeenCalledWith('read-dashboard-file', {
        kind: 'source',
        path: 'src/app.ts',
        revision: 0,
      })
    })

    control.setSnapshot(createResult('next'), initial, 1)
    control.emitDashboardState()
    await vi.waitFor(() => {
      expect(transport.dashboardAnalyzeRevision.value).toBe(1)
    })
    deferred.resolve(response)

    await expect(pendingRead).rejects.toThrow('Analyze revision 已变化')
  })

  it('rejects a file response when its Devframe session disconnects', async () => {
    vi.useFakeTimers()
    const control = createFakeClient(createResult('source'))
    connectDevframeMock.mockResolvedValue(control.client)
    const response = {
      kind: 'source' as const,
      path: 'src/app.ts',
      language: 'typescript',
      size: 20,
      content: 'export const app = 1',
    }
    const deferred = Promise.withResolvers<typeof response>()

    const transport = await loadDashboardTransport()
    await transport.connectDashboardDevframe()
    control.call.mockImplementationOnce(async () => await deferred.promise)
    const pendingRead = transport.readDashboardFileContent('source', 'src/app.ts', 0)
    await vi.advanceTimersByTimeAsync(0)
    control.emitStatus('disconnected')
    deferred.resolve(response)

    await expect(pendingRead).rejects.toThrow('文件读取期间连接已变化')
  })
})

describe('investigation transport identity', () => {
  it('hydrates report identity and updates task metadata without downloading unchanged reports', async () => {
    const control = createFakeClient(createResult('initial'))
    connectDevframeMock.mockResolvedValue(control.client)
    const transport = await loadDashboardTransport()
    await transport.connectDashboardDevframe()
    const report = transport.dashboardReportIdentity.value!
    expect(report).toEqual({ sessionId: 'session:initial', revision: 0, reportHash: serializePayload(createResult('initial')).descriptor.hash })
    const pageCount = control.call.mock.calls.filter(([method]) => method === 'get-analyze-page').length
    const task = createInvestigation(report)
    control.setInvestigations({ version: 1, items: [task] })
    control.emitDashboardState()
    await vi.waitFor(() => expect(transport.dashboardInvestigations.value.items).toEqual([task]))
    expect(transport.dashboardReportIdentity.value).toEqual(report)
    expect(control.call.mock.calls.filter(([method]) => method === 'get-analyze-page')).toHaveLength(pageCount)

    control.setInvestigations({ version: 0, items: [] })
    control.emitDashboardState()
    expect(transport.dashboardInvestigations.value.items).toEqual([task])
  })

  it('withdraws the full identity during hydration and clears tasks on a different controller', async () => {
    const initial = createResult('initial')
    const control = createFakeClient(initial)
    connectDevframeMock.mockResolvedValue(control.client)
    const transport = await loadDashboardTransport()
    await transport.connectDashboardDevframe()
    const task = createInvestigation(transport.dashboardReportIdentity.value!)
    control.setInvestigations({ version: 1, items: [task] })
    control.emitDashboardState()
    await vi.waitFor(() => expect(transport.dashboardInvestigations.value.items).toEqual([task]))

    const ready = Promise.withResolvers<void>()
    const read = control.call.getMockImplementation()!
    control.call.mockImplementationOnce(async (...args) => {
      await ready.promise
      return read(...args)
    })
    control.setSessionId('replacement-controller')
    control.setInvestigations({ version: 0, items: [] })
    control.setSnapshot(createResult('replacement'), null, 0)
    control.emitDashboardState()
    expect(transport.dashboardReportIdentity.value).toBeNull()
    expect(transport.dashboardInvestigations.value.items).toEqual([])
    ready.resolve()
    await vi.waitFor(() => expect(transport.dashboardReportIdentity.value?.sessionId).toBe('replacement-controller'))
  })

  it('dispatches an exact proposal grant and accepts only authoritative state for the task list', async () => {
    const control = createFakeClient(createResult('initial'))
    connectDevframeMock.mockResolvedValue(control.client)
    const transport = await loadDashboardTransport()
    await transport.connectDashboardDevframe()
    const task: DashboardInvestigation = {
      ...createInvestigation(transport.dashboardReportIdentity.value!),
      version: 3,
      status: 'proposed',
      proposal: { id: 'proposal-1', summary: 'Remove duplicate work', changes: [{ path: 'src/a.ts', description: 'Deduplicate' }], checks: ['Run focused test'], risks: [] },
    }
    control.setInvestigations({ version: 3, items: [task] })
    control.emitDashboardState()
    await vi.waitFor(() => expect(transport.dashboardInvestigations.value.version).toBe(3))
    const accepted: DashboardInvestigation = { ...task, version: 4, status: 'authorized', authorization: { proposalId: 'proposal-1', authorizedAt: task.updatedAt } }
    control.call.mockImplementationOnce(async () => {
      control.setInvestigations({ version: 4, items: [accepted] })
      return accepted
    })
    const request = { id: task.id, version: 3, proposalId: 'proposal-1' }
    await expect(transport.authorizeDashboardInvestigation(request)).resolves.toEqual(accepted)
    expect(control.call).toHaveBeenCalledWith('authorize-investigation', request)
    expect(transport.dashboardInvestigations.value).toEqual({ version: 4, items: [accepted] })
    const callCount = control.call.mock.calls.length
    await expect(transport.authorizeDashboardInvestigation(request)).rejects.toThrow()
    expect(control.call).toHaveBeenCalledTimes(callCount)
  })

  it('does not dispatch a stale report or mismatched proposal', async () => {
    const control = createFakeClient(createResult('initial'))
    connectDevframeMock.mockResolvedValue(control.client)
    const transport = await loadDashboardTransport()
    await transport.connectDashboardDevframe()
    const task: DashboardInvestigation = {
      ...createInvestigation(transport.dashboardReportIdentity.value!),
      status: 'proposed',
      proposal: { id: 'replacement', summary: 'Current proposal', changes: [{ path: 'src/a.ts', description: 'Change' }], checks: ['test'], risks: [] },
    }
    control.setInvestigations({ version: 1, items: [task] })
    control.emitDashboardState()
    await vi.waitFor(() => expect(transport.dashboardInvestigations.value.items).toHaveLength(1))
    const count = control.call.mock.calls.length
    await expect(transport.authorizeDashboardInvestigation({ id: task.id, version: task.version, proposalId: 'old' })).rejects.toThrow()
    await expect(transport.createDashboardInvestigation({ report: { ...task.report, reportHash: 'obsolete' }, target: task.target, question: task.question })).rejects.toThrow()
    expect(control.call).toHaveBeenCalledTimes(count)
  })

  it('rejects delayed mutation responses after reconnect without restoring old tasks', async () => {
    const first = createFakeClient(createResult('initial'))
    const second = createFakeClient(createResult('new-session'))
    connectDevframeMock.mockResolvedValueOnce(first.client).mockResolvedValueOnce(second.client)
    const transport = await loadDashboardTransport()
    await transport.connectDashboardDevframe()
    const task = createInvestigation(transport.dashboardReportIdentity.value!)
    const deferred = Promise.withResolvers<DashboardInvestigation>()
    first.call.mockImplementationOnce(() => deferred.promise)
    const pending = transport.createDashboardInvestigation({ report: task.report, target: task.target, question: task.question })
    first.emitStatus('disconnected')
    await transport.connectDashboardDevframe()
    const rejection = expect(pending).rejects.toThrow()
    deferred.resolve(task)
    await rejection
    expect(transport.dashboardReportIdentity.value?.sessionId).toBe('session:new-session')
    expect(transport.dashboardInvestigations.value.items).toEqual([])
    expect(second.call.mock.calls.some(([method]) => method === 'create-investigation')).toBe(false)
  })

  it('ignores a disposed session state query before publishing its metadata', async () => {
    const first = createFakeClient(createResult('initial'))
    const second = createFakeClient(createResult('new-session'))
    connectDevframeMock.mockResolvedValueOnce(first.client).mockResolvedValueOnce(second.client)
    const transport = await loadDashboardTransport()
    await transport.connectDashboardDevframe()
    const task = createInvestigation(transport.dashboardReportIdentity.value!)
    first.setInvestigations({ version: 1, items: [task] })
    const oldState = await first.call('get-dashboard-state') as DashboardState
    const deferred = Promise.withResolvers<DashboardState>()
    first.call.mockResolvedValueOnce(task).mockImplementationOnce(() => deferred.promise)
    const pending = transport.createDashboardInvestigation({ report: task.report, target: task.target, question: task.question })
    await vi.waitFor(() => expect(first.call.mock.calls.filter(([method]) => method === 'get-dashboard-state')).toHaveLength(3))
    first.emitStatus('disconnected')
    await transport.connectDashboardDevframe()
    const rejection = expect(pending).rejects.toThrow()
    deferred.resolve(oldState)
    await rejection
    expect(transport.dashboardReportIdentity.value?.sessionId).toBe('session:new-session')
    expect(transport.dashboardInvestigations.value.items).toEqual([])
    expect(transport.dashboardRuntimeEvents.value[0]?.id).toBe('initial')
  })
})
