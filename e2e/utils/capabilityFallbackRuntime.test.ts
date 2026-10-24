import { describe, expect, it, vi } from 'vitest'
import { captureCapabilityRuntime } from '../ide/statefulHmrDom/capabilityFallbackRuntime'

function fixture() {
  let listener: ((domain: string, event: string, params: unknown) => void) | undefined
  const unsubscribe = vi.fn()
  const cdp = {
    onEvent: vi.fn((receive: typeof listener) => {
      listener = receive
      return unsubscribe
    }),
    sendCommand: vi.fn(async (_domain: string, method: string) => {
      if (method === 'enable') {
        listener?.('Runtime', 'executionContextCreated', { context: { id: 11, uniqueId: 'native-context', name: 'AppService' } })
        return {}
      }
      return { result: { value: { marker: 'FALLBACK-A', identity: '', pageId: 19, timeOrigin: 123 } } }
    }),
  }
  const element = (text: string) => ({
    text: vi.fn(async () => text),
    attribute: vi.fn(async () => ''),
    send: vi.fn(async () => ({ properties: [text], attributes: [''] })),
  })
  const input = element('')
  const page = {
    pageId: 19,
    path: 'pages/native/index',
    $$: vi.fn(async (selector: string) => selector === '.input'
      ? [input]
      : [element(selector === '.marker' ? 'FALLBACK-A' : '0')]),
  }
  const session = {
    currentPage: vi.fn(async () => page),
    evaluateWithOptions: vi.fn(async () => ({ marker: 'STATEFUL-NATIVE-BASE', count: 1, input: 'held-fallback-input', identity: 'before-fallback', pageId: 7 })),
    CDP: vi.fn(() => cdp),
    reLaunch: vi.fn(),
    compile: vi.fn(),
    reconnect: vi.fn(),
    close: vi.fn(),
  }
  return { session, page, input, cdp, unsubscribe }
}

describe('capability fallback failure runtime observations', () => {
  it('retains disagreeing real-frame, wrapper and native context observations without navigation', async () => {
    const h = fixture()
    const captured = await captureCapabilityRuntime(h.session, 'devtools')
    expect(captured).toMatchObject({
      frame: { status: 'fulfilled', value: {
        source: 'devtools-page-frame',
        pageId: 19,
        route: 'pages/native/index',
        nodes: [
          { selector: '.marker', result: { value: [{ text: { value: 'FALLBACK-A' } }] } },
          { selector: '.count', result: { value: [{ text: { value: '0' } }] } },
          { selector: '.input', result: { value: [{ value: { value: '' } }] } },
        ],
      } },
      appFunction: { status: 'fulfilled', value: { marker: 'STATEFUL-NATIVE-BASE', identity: 'before-fallback', pageId: 7 } },
      nativeContext: { status: 'fulfilled', value: {
        runtime: { status: 'fulfilled', value: { result: { value: { marker: 'FALLBACK-A', pageId: 19, timeOrigin: 123 } } } },
        events: [{ event: 'executionContextCreated', id: 11, uniqueId: 'native-context' }],
        cleanup: { status: 'fulfilled' },
      } },
    })
    expect(h.session.currentPage).toHaveBeenCalledExactlyOnceWith({ retries: 1, timeout: 2_500, pageStackFallback: false, appFunctionFallback: false })
    expect(h.session.evaluateWithOptions).toHaveBeenCalledWith(expect.any(Function), { timeout: 2_500 }, expect.objectContaining({ client: expect.any(String) }))
    expect(h.page.$$).toHaveBeenCalledWith('.marker', { fallback: false, timeout: 2_500 })
    expect(h.input.send).toHaveBeenCalledWith('Element.getAttributes', { names: ['value'] }, { timeout: 2_500 })
    expect(h.cdp.sendCommand).toHaveBeenCalledWith('Runtime', 'evaluate', expect.objectContaining({ returnByValue: true, silent: true }), { timeout: 2_500 })
    expect(h.unsubscribe).toHaveBeenCalledOnce()
    for (const action of [h.session.reLaunch, h.session.compile, h.session.reconnect, h.session.close]) {
      expect(action).not.toHaveBeenCalled()
    }
  })

  it('starts the frame and native observations while the App.callFunction observation is still pending', async () => {
    const h = fixture()
    let finish!: (value: Awaited<ReturnType<typeof h.session.evaluateWithOptions>>) => void
    h.session.evaluateWithOptions.mockImplementation(async () => await new Promise<Awaited<ReturnType<typeof h.session.evaluateWithOptions>>>((resolve) => {
      finish = resolve
    }))
    const pending = captureCapabilityRuntime(h.session, 'devtools')
    await Promise.resolve()
    expect(h.session.currentPage).toHaveBeenCalledOnce()
    expect(h.session.CDP).toHaveBeenCalledOnce()
    expect(h.cdp.sendCommand).toHaveBeenCalledWith('Runtime', 'enable', {}, { timeout: 2_500 })
    finish({ marker: 'STATEFUL-NATIVE-BASE', count: 1, input: '', identity: 'before-fallback', pageId: 7 })
    await pending
    expect(h.unsubscribe).toHaveBeenCalledOnce()
  })

  it('keeps failed frame queries and native cleanup separate from successful state samples', async () => {
    const h = fixture()
    h.session.currentPage.mockRejectedValue(new Error('App.getCurrentPage timed out'))
    h.unsubscribe.mockImplementation(() => {
      throw new Error('diagnostic unsubscribe failed')
    })
    const captured = await captureCapabilityRuntime(h.session, 'devtools')
    expect(captured).toMatchObject({
      frame: { status: 'rejected', error: { message: 'App.getCurrentPage timed out' } },
      appFunction: { status: 'fulfilled', value: { identity: 'before-fallback' } },
      nativeContext: { status: 'fulfilled', value: {
        runtime: { status: 'fulfilled' },
        cleanup: { status: 'rejected', error: { message: 'diagnostic unsubscribe failed' } },
      } },
    })
    expect(h.unsubscribe).toHaveBeenCalledOnce()
  })

  it('records unavailable native context for headless and never labels its nodes as real IDE evidence', async () => {
    const h = fixture()
    expect(await captureCapabilityRuntime(h.session, 'headless')).toMatchObject({
      frame: { value: { source: 'headless-page', pageId: 19 } },
      appFunction: { status: 'fulfilled' },
      nativeContext: { value: { status: 'unavailable', reason: 'provider has no native AppService context' } },
    })
    expect(h.session.CDP).not.toHaveBeenCalled()
  })
})
