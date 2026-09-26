import type { AppHideOptions, AppLaunchOptions, PageStackEntry } from '../src/runtime/polyfill/routeRuntime/options'
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

  it('matches native wx subscription snapshots and lifecycle ordering', () => {
    let currentEntry = entry('pages/index/index', { source: 'launch' })
    const runtime = new AppLifecycleRuntime(() => currentEntry)
    const visibilityDocument = new FakeVisibilityDocument()
    const calls: string[] = []
    const showPayloads: AppLaunchOptions[] = []
    const hidePayloads: AppHideOptions[] = []
    const lateShow = (options: AppLaunchOptions) => {
      showPayloads.push(options)
      calls.push(`wx:show:late:${options.path}`)
    }
    const firstShow = (options: AppLaunchOptions) => {
      showPayloads.push(options)
      calls.push(`wx:show:first:${options.path}`)
    }
    const mutateShow = (options: AppLaunchOptions) => {
      showPayloads.push(options)
      calls.push(`wx:show:mutate:${options.path}`)
      runtime.offAppShow(mutateShow)
      runtime.offAppShow(firstShow)
      runtime.onAppShow(lateShow)
    }
    const lateHide = () => calls.push('wx:hide:late')
    const firstHide = (options: AppHideOptions) => {
      hidePayloads.push(options)
      calls.push('wx:hide:first')
    }
    const mutateHide = (options: AppHideOptions) => {
      hidePayloads.push(options)
      calls.push('wx:hide:mutate')
      runtime.offAppHide(mutateHide)
      runtime.offAppHide(firstHide)
      runtime.onAppHide(lateHide)
    }

    runtime.onAppShow(mutateShow)
    runtime.onAppShow(firstShow)
    runtime.onAppShow(firstShow)
    runtime.onAppHide(mutateHide)
    runtime.onAppHide(firstHide)
    runtime.onAppHide(firstHide)
    runtime.register({
      onLaunch(options) {
        showPayloads.push(options)
        calls.push(`app:launch:${options.path}`)
        runtime.onAppShow((showOptions) => {
          showPayloads.push(showOptions)
          calls.push(`wx:show:launch:${showOptions.path}`)
        })
      },
      onShow(options) {
        showPayloads.push(options)
        calls.push(`app:show:${options.path}`)
      },
      onHide(options) {
        hidePayloads.push(options)
        calls.push('app:hide')
      },
    })
    runtime.bindVisibility(visibilityDocument as unknown as Document)

    runtime.ensureLaunched(currentEntry)
    expect(calls).toEqual([
      'app:launch:pages/index/index',
      'app:show:pages/index/index',
      'wx:show:mutate:pages/index/index',
      'wx:show:first:pages/index/index',
      'wx:show:first:pages/index/index',
      'wx:show:launch:pages/index/index',
    ])
    expect(showPayloads).toHaveLength(6)
    expect(new Set(showPayloads).size).toBe(1)

    visibilityDocument.setVisibility('hidden')
    visibilityDocument.setVisibility('hidden')
    expect(calls.slice(-4)).toEqual([
      'wx:hide:mutate',
      'wx:hide:first',
      'wx:hide:first',
      'app:hide',
    ])
    expect(hidePayloads).toHaveLength(4)
    expect(new Set(hidePayloads).size).toBe(1)
    expect(hidePayloads[0]).toEqual({ reason: 3 })

    currentEntry = entry('pages/detail/index', { source: 'resume' })
    showPayloads.length = 0
    visibilityDocument.setVisibility('visible')
    visibilityDocument.setVisibility('visible')
    expect(calls.slice(-3)).toEqual([
      'wx:show:launch:pages/detail/index',
      'wx:show:late:pages/detail/index',
      'app:show:pages/detail/index',
    ])
    expect(showPayloads).toHaveLength(3)
    expect(new Set(showPayloads).size).toBe(1)

    visibilityDocument.setVisibility('hidden')
    expect(calls.slice(-2)).toEqual([
      'wx:hide:late',
      'app:hide',
    ])

    runtime.offAppShow()
    runtime.offAppHide()
    visibilityDocument.setVisibility('visible')
    visibilityDocument.setVisibility('hidden')
    expect(calls.slice(-2)).toEqual([
      'app:show:pages/detail/index',
      'app:hide',
    ])
  })

  it('keeps globalData and replaces lifecycle hooks during registration updates', () => {
    const currentEntry = entry('pages/index/index')
    const runtime = new AppLifecycleRuntime(() => currentEntry)
    const visibilityDocument = new FakeVisibilityDocument()
    const originalGlobalData = { count: 1 }
    const originalHide = vi.fn()
    const updatedHide = vi.fn()
    const appHide = vi.fn()

    runtime.onAppHide(appHide)

    runtime.register({ globalData: originalGlobalData, onHide: originalHide })
    runtime.ensureLaunched(currentEntry)
    runtime.register({ globalData: { count: 999 }, onHide: updatedHide })
    runtime.bindVisibility(visibilityDocument as unknown as Document)
    visibilityDocument.setVisibility('hidden')

    expect(runtime.instance?.globalData).toBe(originalGlobalData)
    expect(runtime.instance?.globalData).toEqual({ count: 1 })
    expect(originalHide).not.toHaveBeenCalled()
    expect(updatedHide).toHaveBeenCalledTimes(1)
    expect(appHide).toHaveBeenCalledTimes(1)
    runtime.dispose()
  })

  it('isolates subscriptions by lifecycle owner and clears them on dispose', () => {
    const currentEntry = entry('pages/index/index')
    const disposedRuntime = new AppLifecycleRuntime(() => currentEntry)
    const activeRuntime = new AppLifecycleRuntime(() => currentEntry)
    const disposedShow = vi.fn()
    const activeShow = vi.fn()

    disposedRuntime.onAppShow(disposedShow)
    activeRuntime.onAppShow(activeShow)
    disposedRuntime.dispose()
    disposedRuntime.register({})
    activeRuntime.register({})
    disposedRuntime.ensureLaunched(currentEntry)
    activeRuntime.ensureLaunched(currentEntry)

    expect(disposedShow).not.toHaveBeenCalled()
    expect(activeShow).toHaveBeenCalledTimes(1)
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
