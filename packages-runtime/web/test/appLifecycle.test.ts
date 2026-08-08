import type { PageStackEntry } from '../src/runtime/polyfill/routeRuntime/options'
import { AppLifecycleRuntime } from '../src/runtime/polyfill/routeRuntime/appLifecycle'

class FakeVisibilityDocument {
  hidden = false
  visibilityState: DocumentVisibilityState = 'visible'
  readonly listeners = new Set<() => void>()

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === 'visibilitychange' && typeof listener === 'function') {
      this.listeners.add(listener as () => void)
    }
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === 'visibilitychange' && typeof listener === 'function') {
      this.listeners.delete(listener as () => void)
    }
  }

  setVisibility(state: DocumentVisibilityState) {
    this.visibilityState = state
    this.hidden = state === 'hidden'
    for (const listener of this.listeners) {
      listener()
    }
  }
}

function entry(id: string, query: Record<string, string> = {}): PageStackEntry {
  return { id, query, active: true }
}

describe('AppLifecycleRuntime', () => {
  it('launches before page mount and bridges document visibility without duplicate callbacks', () => {
    let currentEntry = entry('pages/index/index', { source: 'launch' })
    const runtime = new AppLifecycleRuntime(() => currentEntry)
    const visibilityDocument = new FakeVisibilityDocument()
    const calls: Array<{ type: string, path?: string }> = []

    runtime.register({
      globalData: {},
      onLaunch(options) {
        calls.push({ type: 'launch', path: options.path })
      },
      onShow(options) {
        calls.push({ type: 'show', path: options.path })
      },
      onHide() {
        calls.push({ type: 'hide' })
      },
    })
    runtime.bindVisibility(visibilityDocument as unknown as Document)
    runtime.ensureLaunched(currentEntry)

    expect(calls).toEqual([
      { type: 'launch', path: 'pages/index/index' },
      { type: 'show', path: 'pages/index/index' },
    ])
    expect(runtime.getLaunchOptions()).toMatchObject({
      path: 'pages/index/index',
      query: { source: 'launch' },
    })

    visibilityDocument.setVisibility('hidden')
    visibilityDocument.setVisibility('hidden')
    currentEntry = entry('pages/detail/index', { sku: '42' })
    visibilityDocument.setVisibility('visible')
    visibilityDocument.setVisibility('visible')

    expect(calls).toEqual([
      { type: 'launch', path: 'pages/index/index' },
      { type: 'show', path: 'pages/index/index' },
      { type: 'hide' },
      { type: 'show', path: 'pages/detail/index' },
    ])
    expect(runtime.getEnterOptions()).toMatchObject({
      path: 'pages/detail/index',
      query: { sku: '42' },
    })

    runtime.dispose()
    expect(visibilityDocument.listeners.size).toBe(0)
  })

  it('keeps globalData and replaces lifecycle hooks during registration updates', () => {
    const currentEntry = entry('pages/index/index')
    const runtime = new AppLifecycleRuntime(() => currentEntry)
    const visibilityDocument = new FakeVisibilityDocument()
    const originalGlobalData = { count: 1 }
    const originalHide = vi.fn()
    const updatedHide = vi.fn()

    runtime.register({ globalData: originalGlobalData, onHide: originalHide })
    runtime.ensureLaunched(currentEntry)
    runtime.register({ globalData: { count: 999 }, onHide: updatedHide })
    runtime.bindVisibility(visibilityDocument as unknown as Document)
    visibilityDocument.setVisibility('hidden')

    expect(runtime.instance?.globalData).toBe(originalGlobalData)
    expect(runtime.instance?.globalData).toEqual({ count: 1 })
    expect(originalHide).not.toHaveBeenCalled()
    expect(updatedHide).toHaveBeenCalledTimes(1)
    runtime.dispose()
  })

  it('marks launch state before callbacks can trigger another route mount', () => {
    const currentEntry = entry('pages/index/index')
    const runtime = new AppLifecycleRuntime(() => currentEntry)
    const onLaunch = vi.fn(() => runtime.ensureLaunched(entry('pages/redirect/index')))
    const onShow = vi.fn()

    runtime.register({ onLaunch, onShow })
    runtime.ensureLaunched(currentEntry)

    expect(onLaunch).toHaveBeenCalledTimes(1)
    expect(onShow).toHaveBeenCalledTimes(1)
  })
})
