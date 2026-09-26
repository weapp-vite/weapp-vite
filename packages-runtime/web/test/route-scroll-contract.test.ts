import type { PageStackEntry } from '../src/runtime/polyfill/routeRuntime/options'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bindPageScrollOwner,
  captureEntryScrollPosition,
  claimPageScrollRestoration,
  disposePageScrollOwner,
  recordActiveEntryScrollPosition,
  restoreEntryScrollPosition,
  setEntryScrollOwner,
} from '../src/runtime/polyfill/routeRuntime/scroll'

const runtime = vi.hoisted(() => ({
  container: undefined as any,
}))

vi.mock('../src/runtime/appShell/container', () => ({
  getAppContainer: () => runtime.container,
}))

function createContainer(scrollTop = 0) {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    scrollTop,
  }
}

describe('route scroll ownership contract', () => {
  afterEach(() => {
    disposePageScrollOwner()
    runtime.container = undefined
    vi.clearAllMocks()
  })

  it('captures and restores active entries with container fallbacks', () => {
    const entry: PageStackEntry = { active: false, id: 'pages/home', query: {} }
    captureEntryScrollPosition(entry)
    entry.active = true
    captureEntryScrollPosition(entry)

    const container = createContainer(42)
    runtime.container = container
    captureEntryScrollPosition(entry)
    expect(entry.scrollTop).toBe(42)

    entry.scrollTop = undefined
    restoreEntryScrollPosition(entry)
    expect(container.scrollTop).toBe(0)
    entry.scrollTop = 18
    restoreEntryScrollPosition(entry)
    expect(container.scrollTop).toBe(18)
    runtime.container = undefined
    restoreEntryScrollPosition(entry)
  })

  it('records only the active owner and clears matching owners', () => {
    const first: PageStackEntry = { active: true, id: 'pages/first', query: {} }
    const second: PageStackEntry = { active: true, id: 'pages/second', query: {} }
    runtime.container = createContainer(25)
    recordActiveEntryScrollPosition()
    setEntryScrollOwner(first, true)
    recordActiveEntryScrollPosition()
    expect(first.scrollTop).toBe(25)
    setEntryScrollOwner(second, false)
    runtime.container.scrollTop = 30
    recordActiveEntryScrollPosition()
    expect(first.scrollTop).toBe(30)
    setEntryScrollOwner(first, false)
    runtime.container.scrollTop = 35
    recordActiveEntryScrollPosition()
    expect(first.scrollTop).toBe(30)
  })

  it('suppresses only claimed fresh restores and releases independent claims idempotently', () => {
    const page = {} as NonNullable<PageStackEntry['instance']>
    const entry: PageStackEntry = { active: true, id: 'pages/claimed', query: {}, instance: page, scrollTop: 60 }
    const other: PageStackEntry = { active: true, id: 'pages/other', query: {}, instance: {} as typeof page, scrollTop: 15 }
    runtime.container = createContainer(40)
    const releaseFirst = claimPageScrollRestoration(page)
    const releaseSecond = claimPageScrollRestoration(page)
    restoreEntryScrollPosition(entry)
    expect(runtime.container.scrollTop).toBe(40)
    releaseFirst()
    releaseFirst()
    restoreEntryScrollPosition(entry)
    expect(runtime.container.scrollTop).toBe(40)
    restoreEntryScrollPosition(other)
    expect(runtime.container.scrollTop).toBe(15)
    restoreEntryScrollPosition(entry, true)
    expect(runtime.container.scrollTop).toBe(60)
    runtime.container.scrollTop = 75
    releaseSecond()
    restoreEntryScrollPosition(entry)
    expect(runtime.container.scrollTop).toBe(60)
  })

  it('binds once, replaces containers and disposes listener state', () => {
    const first = createContainer()
    const second = createContainer()
    bindPageScrollOwner(first as any)
    bindPageScrollOwner(first as any)
    expect(first.addEventListener).toHaveBeenCalledOnce()
    bindPageScrollOwner(second as any)
    expect(first.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(second.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true })
    disposePageScrollOwner()
    expect(second.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))
    disposePageScrollOwner()
  })
})
