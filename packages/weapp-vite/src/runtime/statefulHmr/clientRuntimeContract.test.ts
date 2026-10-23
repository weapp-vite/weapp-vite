import { createContext, runInContext } from 'node:vm'
import {
  WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY,
  WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY,
  WEAPP_VITE_STATEFUL_HMR_RUNTIME_CONTRACT_METHOD,
  WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE,
} from '@weapp-core/constants'
import { describe, expect, it, vi } from 'vitest'
import { createStatefulHmrRolldownRuntimeSource } from './commonRuntime'
import { createStatefulHmrControlSource } from './runtimeSource'

interface ClientRequest {
  data: { action: string, version: number, failure?: { reason: string, message?: string } }
  success: (result: { statusCode: number, data: { type?: string, ready?: boolean } }) => void
  fail: (error: { errMsg: string, errno?: number }) => void
}

function createClient() {
  const requests: ClientRequest[] = []
  const context = createContext({
    console: { warn: vi.fn(), error: vi.fn() },
    setTimeout: vi.fn(),
    clearTimeout: vi.fn(),
    wx: {
      request(options: ClientRequest) {
        requests.push(options)
        return { abort: vi.fn() }
      },
    },
  })
  runInContext(createStatefulHmrRolldownRuntimeSource(), context)
  runInContext(createStatefulHmrControlSource({ buildId: 'build', token: 'token', url: 'http://localhost/hmr' }), context)
  requests[0]!.success({ statusCode: 200, data: { type: 'registered', ready: true } })
  return {
    context,
    requests,
    client: context[WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY],
    bridge: context[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY],
    runtime: context.__rolldown_runtime__,
    batch: { buildId: 'build', fromVersion: 0, targetVersion: 1, changedIds: [] },
  }
}

describe('shared stateful runtime capability gate', () => {
  it.each(['bridge missing', 'bridge not ready', 'prepareUpdate', 'applyPreparedUpdate', 'installNative', 'takeNativeDefinitions', 'App', 'Page', 'Component'])(
    'reports %s once before accepting any more native entries or batches',
    (missing) => {
      const fixture = createClient()
      const apply = vi.fn()
      try {
        if (missing === 'bridge missing') {
          expect(runInContext(`Reflect.deleteProperty(globalThis, ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)})`, fixture.context)).toBe(true)
          expect(runInContext(`${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)} in globalThis`, fixture.context)).toBe(false)
        }
        else if (missing === 'bridge not ready') {
          fixture.bridge.ready = false
        }
        else { Reflect.set(missing === 'prepareUpdate' || missing === 'applyPreparedUpdate' ? fixture.runtime : fixture.bridge, missing, undefined) }
        expect(fixture.client[WEAPP_VITE_STATEFUL_HMR_RUNTIME_CONTRACT_METHOD](true)).toBe(false)
        expect(fixture.client[WEAPP_VITE_STATEFUL_HMR_RUNTIME_CONTRACT_METHOD](true)).toBe(false)
        fixture.client.receiveBatch(fixture.batch, apply)
        fixture.client.payloadDelivered('late-entry.js')
        const rebuilds = fixture.requests.filter(request => request.data.action === 'rebuild')
        expect(rebuilds).toHaveLength(1)
        expect(rebuilds[0]!.data).toMatchObject({ action: 'rebuild', version: 0, failure: { reason: 'bridge-not-ready' } })
        expect(apply).not.toHaveBeenCalled()
        expect(fixture.client.getVersion()).toBe(0)
        expect(fixture.context.setTimeout).not.toHaveBeenCalled()
        expect(fixture.context.console.warn).toHaveBeenCalledExactlyOnceWith('[weapp-vite] stateful HMR bridge is not ready; rebuilding in classic mode')
        expect(fixture.context.console.error).not.toHaveBeenCalled()
      }
      finally { fixture.client.stop() }
    },
  )

  it.each(['prepareUpdate', 'applyPreparedUpdate'])('checks the batch dependency %s before executing business code', (missing) => {
    const fixture = createClient()
    const apply = vi.fn()
    try {
      Reflect.set(fixture.runtime, missing, undefined)
      fixture.client.receiveBatch(fixture.batch, apply)
      expect(apply).not.toHaveBeenCalled()
      expect(fixture.requests.at(-1)!.data).toMatchObject({ action: 'rebuild', failure: { reason: 'bridge-not-ready' } })
      expect(fixture.client.getVersion()).toBe(0)
      expect(fixture.context.console.error).not.toHaveBeenCalled()
    }
    finally { fixture.client.stop() }
  })

  it('uses the same ready contract for native entries and batches while preserving business failure classification', () => {
    const fixture = createClient()
    const failure = new Error('business failure after ready gate')
    try {
      expect(fixture.client[WEAPP_VITE_STATEFUL_HMR_RUNTIME_CONTRACT_METHOD](true)).toBe(true)
      expect(fixture.client[WEAPP_VITE_STATEFUL_HMR_RUNTIME_CONTRACT_METHOD]()).toBe(true)
      fixture.client.receiveBatch(fixture.batch, () => {
        throw failure
      })
      expect(fixture.requests.at(-1)!.data).toMatchObject({ action: 'rebuild', version: 0, failure: { reason: 'patch-failed', message: failure.message } })
      expect(fixture.context.console.error).toHaveBeenCalledExactlyOnceWith('[weapp-vite] stateful HMR patch failed', failure)
      expect(fixture.context.console.warn).not.toHaveBeenCalled()
    }
    finally { fixture.client.stop() }
  })

  it('retains the accepted version when a later native replay loses its runtime contract', () => {
    const fixture = createClient()
    try {
      fixture.client.receiveBatch(fixture.batch, () => {})
      expect(fixture.client.getVersion()).toBe(1)
      expect(runInContext(`Reflect.deleteProperty(globalThis, ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)})`, fixture.context)).toBe(true)
      expect(runInContext(`${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)} in globalThis`, fixture.context)).toBe(false)
      expect(fixture.client[WEAPP_VITE_STATEFUL_HMR_RUNTIME_CONTRACT_METHOD](true)).toBe(false)
      expect(fixture.requests.at(-1)!.data).toMatchObject({ action: 'rebuild', version: 1, failure: { reason: 'bridge-not-ready' } })
      expect(fixture.client.getVersion()).toBe(1)
    }
    finally { fixture.client.stop() }
  })

  it('keeps a stopped client inactive when a stale native entry checks its contract', () => {
    const fixture = createClient()
    fixture.client.stop()
    expect(fixture.client[WEAPP_VITE_STATEFUL_HMR_RUNTIME_CONTRACT_METHOD](true)).toBe(false)
    expect(fixture.requests.map(request => request.data.action)).toEqual(['register', 'poll'])
    expect(fixture.context.console.warn).not.toHaveBeenCalled()
  })

  it.each(['missing bridge', 'unsupported registration'])('stops after the first %s fallback transport failure and ignores late callbacks, entries and batches', (capability) => {
    const fixture = createClient()
    const apply = vi.fn()
    try {
      const stalePoll = fixture.requests.at(-1)!
      if (capability === 'missing bridge') {
        expect(runInContext(`Reflect.deleteProperty(globalThis, ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)})`, fixture.context)).toBe(true)
        expect(runInContext(`${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)} in globalThis`, fixture.context)).toBe(false)
        expect(fixture.client[WEAPP_VITE_STATEFUL_HMR_RUNTIME_CONTRACT_METHOD](true)).toBe(false)
      }
      else {
        fixture.bridge.endUpdate = vi.fn()
        fixture.client.receiveBatch(fixture.batch, () => {
          throw Object.assign(new Error('native registration shape changed'), { code: WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE })
        })
      }
      const rebuild = fixture.requests.at(-1)!
      rebuild.fail({ errMsg: 'request:fail fallback unavailable', errno: 1 })
      const firstFailure = { action: 'rebuild', errMsg: 'request:fail fallback unavailable', errno: 1 }
      expect(fixture.client.getTransportState()).toMatchObject({ phase: 'stopped', version: 0, lastRequestError: firstFailure })
      stalePoll.fail({ errMsg: 'request:fail stale poll' })
      rebuild.success({ statusCode: 200, data: { type: 'rebuilding' } })
      rebuild.fail({ errMsg: 'request:fail late duplicate' })
      expect(fixture.client[WEAPP_VITE_STATEFUL_HMR_RUNTIME_CONTRACT_METHOD](true)).toBe(false)
      fixture.client.receiveBatch(fixture.batch, apply)
      fixture.client.payloadDelivered('late-entry.js')
      expect(fixture.requests.map(request => request.data.action)).toEqual(['register', 'poll', 'rebuild'])
      expect(fixture.context.setTimeout).not.toHaveBeenCalled()
      expect(apply).not.toHaveBeenCalled()
      expect(fixture.client.getTransportState()).toMatchObject({ phase: 'stopped', lastRequestError: firstFailure })
      expect(fixture.context.console.error).toHaveBeenCalledExactlyOnceWith('[weapp-vite] stateful HMR classic fallback request failed', firstFailure)
    }
    finally { fixture.client.stop() }
  })

  it.each(['missing bridge', 'unsupported registration'])('stops the %s fallback client after a rebuilding response without registering or polling again', (capability) => {
    const fixture = createClient()
    const apply = vi.fn()
    try {
      const stalePoll = fixture.requests.at(-1)!
      if (capability === 'missing bridge') {
        expect(runInContext(`Reflect.deleteProperty(globalThis, ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)})`, fixture.context)).toBe(true)
        expect(runInContext(`${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)} in globalThis`, fixture.context)).toBe(false)
        expect(fixture.client[WEAPP_VITE_STATEFUL_HMR_RUNTIME_CONTRACT_METHOD](true)).toBe(false)
      }
      else {
        fixture.bridge.endUpdate = vi.fn()
        fixture.client.receiveBatch(fixture.batch, () => {
          throw Object.assign(new Error('native registration shape changed'), { code: WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE })
        })
      }
      const rebuild = fixture.requests.at(-1)!
      rebuild.success({ statusCode: 202, data: { type: 'rebuilding' } })
      expect(fixture.client.getTransportState()).toMatchObject({ phase: 'stopped', version: 0, lastResponse: { action: 'rebuild', statusCode: 202, type: 'rebuilding' } })
      stalePoll.success({ statusCode: 200, data: { type: 'registered', ready: true } })
      rebuild.success({ statusCode: 200, data: { type: 'idle' } })
      rebuild.fail({ errMsg: 'request:fail late callback' })
      fixture.client.receiveBatch(fixture.batch, apply)
      fixture.client.payloadDelivered('late-entry.js')
      expect(fixture.client[WEAPP_VITE_STATEFUL_HMR_RUNTIME_CONTRACT_METHOD](true)).toBe(false)
      expect(fixture.requests.map(request => request.data.action)).toEqual(['register', 'poll', 'rebuild'])
      expect(fixture.context.setTimeout).not.toHaveBeenCalled()
      expect(apply).not.toHaveBeenCalled()
      expect(fixture.client.getTransportState()).toMatchObject({ phase: 'stopped', lastResponse: { action: 'rebuild', statusCode: 202, type: 'rebuilding' } })
      expect(fixture.context.console.error).not.toHaveBeenCalled()
    }
    finally { fixture.client.stop() }
  })

  it('keeps a late relaunch completion from replacing the in-flight classic fallback request', () => {
    const fixture = createClient()
    let complete: (() => void) | undefined
    try {
      fixture.bridge.endUpdate = vi.fn()
      fixture.context.getCurrentPages = () => [{ route: 'pages/index/index', options: { source: 'late-relaunch' } }]
      fixture.context.wx.reLaunch = vi.fn((options: { complete: () => void }) => {
        complete = options.complete
      })
      fixture.client.receiveBatch({ ...fixture.batch, compatible: false }, () => {})
      expect(fixture.client.getTransportState()).toMatchObject({ phase: 'relaunching', version: 1 })
      expect(complete).toBeTypeOf('function')
      expect(runInContext(`Reflect.deleteProperty(globalThis, ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)})`, fixture.context)).toBe(true)
      expect(runInContext(`${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)} in globalThis`, fixture.context)).toBe(false)
      expect(fixture.client[WEAPP_VITE_STATEFUL_HMR_RUNTIME_CONTRACT_METHOD](true)).toBe(false)
      const rebuild = fixture.requests.at(-1)!
      complete!()
      expect(fixture.requests.map(request => request.data.action)).toEqual(['register', 'poll', 'rebuild'])
      rebuild.fail({ errMsg: 'request:fail fallback unavailable' })
      expect(fixture.client.getTransportState()).toMatchObject({ phase: 'stopped', version: 1, lastRequestError: { action: 'rebuild', errMsg: 'request:fail fallback unavailable' } })
      expect(fixture.context.console.error).toHaveBeenCalledExactlyOnceWith('[weapp-vite] stateful HMR classic fallback request failed', fixture.client.getTransportState().lastRequestError)
      expect(fixture.context.setTimeout).not.toHaveBeenCalled()
    }
    finally { fixture.client.stop() }
  })

  it.each([
    { statusCode: 403, type: 'forbidden' },
    { statusCode: 500, type: 'server-error' },
    { statusCode: 500, type: 'rebuilding' },
    { statusCode: 500, type: 'retired' },
    { statusCode: 422, type: 'error' },
    { statusCode: 200, type: 'idle' },
    { statusCode: 200, type: 'registered' },
    { statusCode: 202, type: undefined },
  ])('preserves a rejected classic fallback response as an error (HTTP $statusCode, type $type)', ({ statusCode, type }) => {
    const fixture = createClient()
    try {
      expect(runInContext(`Reflect.deleteProperty(globalThis, ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)})`, fixture.context)).toBe(true)
      expect(runInContext(`${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)} in globalThis`, fixture.context)).toBe(false)
      expect(fixture.client[WEAPP_VITE_STATEFUL_HMR_RUNTIME_CONTRACT_METHOD](true)).toBe(false)
      const rebuild = fixture.requests.at(-1)!
      rebuild.success({ statusCode, data: { type } })
      const firstFailure = fixture.client.getTransportState().lastRequestError
      expect(firstFailure).toMatchObject({ action: 'rebuild', statusCode, type, errMsg: expect.any(String) })
      expect(fixture.context.console.error).toHaveBeenCalledExactlyOnceWith('[weapp-vite] stateful HMR classic fallback request failed', firstFailure)
      expect(fixture.client.getTransportState()).toMatchObject({ phase: 'stopped', version: 0, lastResponse: { action: 'rebuild', statusCode, type } })
      rebuild.success({ statusCode: 202, data: { type: 'rebuilding' } })
      rebuild.fail({ errMsg: 'request:fail late callback' })
      expect(fixture.client.getTransportState()).toMatchObject({ phase: 'stopped', lastRequestError: firstFailure, lastResponse: { action: 'rebuild', statusCode, type } })
      expect(fixture.requests.map(request => request.data.action)).toEqual(['register', 'poll', 'rebuild'])
      expect(fixture.context.setTimeout).not.toHaveBeenCalled()
    }
    finally { fixture.client.stop() }
  })
})
