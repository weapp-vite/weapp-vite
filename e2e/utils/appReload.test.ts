import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureAppReloadMarker, waitForAppReload } from './appReload'

function createHost() {
  let app: Record<string, unknown> | undefined = { applicationValue: 'preserved' }
  let pages: Array<{ route: string }> = [{ route: 'pages/index/index' }]
  let size = { width: 100, height: 20 }
  let queryError: Error | undefined
  const query = {
    in: vi.fn(() => query),
    select: vi.fn(() => query),
    fields: vi.fn(() => query),
    exec: vi.fn((callback: (results: unknown[]) => void) => {
      if (queryError) {
        throw queryError
      }
      callback([size])
    }),
  }
  vi.stubGlobal('getApp', () => app)
  vi.stubGlobal('getCurrentPages', () => pages)
  vi.stubGlobal('wx', { createSelectorQuery: () => query })
  const session = {
    evaluateWithOptions: vi.fn(async (fn: (...args: any[]) => unknown, _options: { timeout: number }, ...args: unknown[]) => fn(...args)),
    reLaunch: vi.fn(),
    compile: vi.fn(),
    disconnect: vi.fn(),
  }
  return {
    session,
    query,
    get app() { return app },
    replaceApp: (next: Record<string, unknown> | undefined = {}) => { app = next },
    setPages: (next: typeof pages) => { pages = next },
    setSize: (next: typeof size) => { size = next },
    failQuery: (error: Error | undefined) => { queryError = error },
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('App reload boundary', () => {
  it('marks one App without overwriting its data and independently verifies the marker', async () => {
    const host = createHost()
    const marker = await captureAppReloadMarker(host.session)
    expect(host.session.evaluateWithOptions).toHaveBeenCalledTimes(2)
    expect(Object.keys(host.app!)).toEqual(['applicationValue'])
    expect(Object.getOwnPropertyDescriptor(host.app, marker.key)).toEqual({ value: marker.token, enumerable: false, writable: false, configurable: false })
    const next = await captureAppReloadMarker(host.session)
    expect(next.key).not.toBe(marker.key)
    expect(host.app![marker.key]).toBe(marker.token)
    expect(host.app!.applicationValue).toBe('preserved')
  })

  it('rejects a marker written to an App facade that is not persistent across protocol reads', async () => {
    const host = createHost()
    vi.stubGlobal('getApp', () => ({}))
    await expect(captureAppReloadMarker(host.session)).rejects.toThrow('independent protocol read')
  })

  it('does not treat a visible page on the old App as a completed reload', async () => {
    const host = createHost()
    const marker = await captureAppReloadMarker(host.session)
    const outcome = expect(waitForAppReload(host.session, marker, '.root', 500)).rejects.toThrow('Timed out')
    await vi.advanceTimersByTimeAsync(500)
    await outcome
    expect(host.query.select).toHaveBeenCalledWith('.root')
    expect(host.session.reLaunch).not.toHaveBeenCalled()
    expect(host.session.compile).not.toHaveBeenCalled()
  })

  it('waits for a visible native root after the App has been replaced', async () => {
    const host = createHost()
    const marker = await captureAppReloadMarker(host.session)
    host.replaceApp()
    host.setSize({ width: 0, height: 0 })
    const fulfilled = vi.fn()
    const pending = waitForAppReload(host.session, marker, '.root', 1_000).then(fulfilled)
    await vi.advanceTimersByTimeAsync(400)
    expect(fulfilled).not.toHaveBeenCalled()
    host.setSize({ width: 100, height: 20 })
    await vi.advanceTimersByTimeAsync(200)
    await pending
    expect(fulfilled).toHaveBeenCalledWith(expect.objectContaining({ appReplaced: true, rootVisible: true }))
    expect(host.session.reLaunch).not.toHaveBeenCalled()
    expect(host.session.disconnect).not.toHaveBeenCalled()
  })

  it('accepts a genuinely replaced App and visible current page without navigating', async () => {
    const host = createHost()
    const marker = await captureAppReloadMarker(host.session)
    host.replaceApp()
    const result = await waitForAppReload(host.session, marker, '.root')
    expect(result).toEqual({ appPresent: true, appReplaced: true, pagePresent: true, rootVisible: true, route: 'pages/index/index', width: 100, height: 20 })
    expect(host.session.reLaunch).not.toHaveBeenCalled()
    expect(host.session.compile).not.toHaveBeenCalled()
    expect(host.session.disconnect).not.toHaveBeenCalled()
  })

  it.each(['App', 'page'])('rejects an old selector response when the %s changes during the query', async (target) => {
    const host = createHost()
    const marker = await captureAppReloadMarker(host.session)
    host.replaceApp()
    host.query.exec.mockImplementation((callback) => {
      if (target === 'App') {
        host.replaceApp()
      }
      else {
        host.setPages([{ route: 'pages/other/index' }])
      }
      callback([{ width: 100, height: 20 }])
    })
    const outcome = expect(waitForAppReload(host.session, marker, '.root', 500)).rejects.toThrow('Timed out')
    await vi.advanceTimersByTimeAsync(500)
    await outcome
    expect(host.session.reLaunch).not.toHaveBeenCalled()
  })

  it.each(['no App', 'no page', 'token read failed', 'selector failed', 'protocol failed'])('does not infer reload from %s', async (failure) => {
    const host = createHost()
    const marker = await captureAppReloadMarker(host.session)
    host.replaceApp()
    if (failure === 'no App') {
      vi.stubGlobal('getApp', () => undefined)
    }
    if (failure === 'no page') {
      host.setPages([])
    }
    if (failure === 'token read failed') {
      Object.defineProperty(host.app, marker.key, {
        get() {
          throw new Error('token read failed')
        },
      })
    }
    if (failure === 'selector failed') {
      host.failQuery(new Error('selector failed'))
    }
    if (failure === 'protocol failed') {
      host.session.evaluateWithOptions.mockRejectedValue(new Error('protocol failed'))
    }
    const outcome = expect(waitForAppReload(host.session, marker, '.root', 500)).rejects.toThrow('Timed out')
    await vi.advanceTimersByTimeAsync(500)
    await outcome
    expect(host.session.reLaunch).not.toHaveBeenCalled()
  })

  it('continues after a transitional protocol error and caps reads by the remaining deadline', async () => {
    const host = createHost()
    const marker = await captureAppReloadMarker(host.session)
    host.replaceApp()
    host.session.evaluateWithOptions.mockRejectedValueOnce(new Error('AppService restarting'))
    const pending = waitForAppReload(host.session, marker, '.root', 500)
    await vi.advanceTimersByTimeAsync(200)
    await expect(pending).resolves.toMatchObject({ appReplaced: true, rootVisible: true })
    const timeoutValues = host.session.evaluateWithOptions.mock.calls.slice(2).map(([, options]) => options.timeout)
    expect(timeoutValues).toEqual([500, 300])
  })

  it('bounds an unanswered selector request by the remaining protocol timeout', async () => {
    const host = createHost()
    const marker = await captureAppReloadMarker(host.session)
    host.replaceApp()
    host.session.evaluateWithOptions.mockImplementation((_fn, { timeout }) => new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error('App.callFunction timed out')), timeout)
    }))
    const outcome = expect(waitForAppReload(host.session, marker, '.root', 500)).rejects.toThrow('App.callFunction timed out')
    await vi.advanceTimersByTimeAsync(500)
    await outcome
    expect(host.session.evaluateWithOptions).toHaveBeenLastCalledWith(expect.any(Function), { timeout: 500 }, marker, '.root')
  })
})
