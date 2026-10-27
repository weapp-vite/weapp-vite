import type { PageStackEntry } from '../src/runtime/polyfill/routeRuntime/options'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  bindPageScrollOwner,
  claimPageScrollRestoration,
  disposePageScrollOwner,
  recordActiveEntryScrollPosition,
  restoreEntryScrollPosition,
  setEntryScrollOwner,
} from '../src/runtime/polyfill/routeRuntime/scroll'
import { pageScrollToBridge } from '../src/runtime/polyfill/runtimeOps'

class FakeScrollContainer extends EventTarget {
  scrollHeight = 1000
  clientHeight = 300
  scrollTop = 0
}

function createEntry(page: { onPageScroll?: ReturnType<typeof vi.fn>, onReachBottom?: ReturnType<typeof vi.fn> }) {
  const entry: PageStackEntry = {
    id: 'pages/list/index',
    query: {},
    active: true,
    instance: page as unknown as PageStackEntry['instance'],
  }
  return entry
}

describe('page onReachBottom', () => {
  let container: FakeScrollContainer
  let calls: string[]
  let page: { onPageScroll: ReturnType<typeof vi.fn>, onReachBottom: ReturnType<typeof vi.fn> }
  let entry: PageStackEntry

  function scroll(top: number) {
    container.scrollTop = top
    container.dispatchEvent(new Event('scroll'))
  }

  beforeEach(() => {
    container = new FakeScrollContainer()
    calls = []
    page = {
      onPageScroll: vi.fn(() => calls.push('onPageScroll')),
      onReachBottom: vi.fn(() => calls.push('onReachBottom')),
    }
    entry = createEntry(page)
    vi.stubGlobal('document', { querySelector: (selector: string) => selector === '#app' ? container : null })
    bindPageScrollOwner(container as unknown as HTMLElement)
    setEntryScrollOwner(entry, true)
  })

  afterEach(() => {
    disposePageScrollOwner()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('reports the bottom once per approach and keeps onPageScroll order', () => {
    scroll(649)
    expect(page.onReachBottom).not.toHaveBeenCalled()
    calls.length = 0
    scroll(650)
    expect(calls).toEqual(['onPageScroll', 'onReachBottom'])
    scroll(700)
    expect(page.onReachBottom).toHaveBeenCalledTimes(1)
    scroll(100)
    scroll(700)
    expect(page.onReachBottom).toHaveBeenCalledTimes(2)
  })

  it.each([100, 300])('rearms after appending %i pixels without an intermediate scroll', async (height) => {
    scroll(700)
    await Promise.resolve()
    container.scrollHeight += height
    expect(page.onReachBottom).toHaveBeenCalledTimes(1)

    scroll(container.scrollHeight - container.clientHeight)
    expect(page.onReachBottom).toHaveBeenCalledTimes(2)
    scroll(container.scrollTop)
    expect(page.onReachBottom).toHaveBeenCalledTimes(2)
  })

  it('keeps the latest position while moving inside the bottom threshold', () => {
    scroll(650)
    scroll(700)
    container.scrollHeight += 40
    scroll(740)
    expect(page.onReachBottom).toHaveBeenCalledTimes(1)
  })

  it('rearms when a smaller viewport moves the previous position away from the bottom', () => {
    scroll(700)
    container.clientHeight = 100
    scroll(900)
    expect(page.onReachBottom).toHaveBeenCalledTimes(2)
  })

  it.each([false, true])('does not report while restoring a bottom position (retained=%s)', (retained) => {
    entry.scrollTop = 650
    restoreEntryScrollPosition(entry, retained)
    recordActiveEntryScrollPosition()
    expect(page.onReachBottom).not.toHaveBeenCalled()
    scroll(100)
    scroll(700)
    expect(page.onReachBottom).toHaveBeenCalledTimes(1)
  })

  it('keeps retained page states independent and handles content added while hidden', () => {
    scroll(700)
    entry.active = false
    setEntryScrollOwner(entry, false)
    const otherPage = { onReachBottom: vi.fn() }
    const otherEntry = createEntry(otherPage)
    setEntryScrollOwner(otherEntry, true)
    restoreEntryScrollPosition(otherEntry)
    scroll(700)
    expect(otherPage.onReachBottom).toHaveBeenCalledTimes(1)

    otherEntry.active = false
    setEntryScrollOwner(otherEntry, false)
    container.scrollHeight += 100
    entry.active = true
    setEntryScrollOwner(entry, true)
    restoreEntryScrollPosition(entry, true)
    expect(container.scrollTop).toBe(700)
    recordActiveEntryScrollPosition()
    expect(page.onReachBottom).toHaveBeenCalledTimes(1)
    scroll(800)
    expect(page.onReachBottom).toHaveBeenCalledTimes(2)
  })

  it('uses the clamped restored position when content later grows', () => {
    let actualTop = 0
    Object.defineProperty(container, 'scrollTop', {
      get: () => actualTop,
      set: (value: number) => {
        actualTop = Math.max(0, Math.min(value, container.scrollHeight - container.clientHeight))
      },
    })
    entry.scrollTop = 9999
    restoreEntryScrollPosition(entry, true)
    expect(container.scrollTop).toBe(700)
    recordActiveEntryScrollPosition()
    expect(page.onReachBottom).not.toHaveBeenCalled()
    container.scrollHeight += 100
    scroll(800)
    expect(page.onReachBottom).toHaveBeenCalledTimes(1)
  })

  it('deduplicates pageScrollTo and the following browser scroll event', async () => {
    await pageScrollToBridge({ scrollTop: 700, duration: 0 })
    scroll(700)
    expect(page.onReachBottom).toHaveBeenCalledTimes(1)
    container.scrollHeight += 100
    await pageScrollToBridge({ scrollTop: 800, duration: 0 })
    scroll(800)
    expect(page.onReachBottom).toHaveBeenCalledTimes(2)
  })

  it('preserves restoration claims without suppressing explicit pageScrollTo', async () => {
    const release = claimPageScrollRestoration(entry.instance!)
    entry.scrollTop = 650
    restoreEntryScrollPosition(entry)
    expect(container.scrollTop).toBe(0)
    await pageScrollToBridge({ scrollTop: 700, duration: 0 })
    expect(page.onReachBottom).toHaveBeenCalledTimes(1)
    release()
  })

  it.each(['remove', 'replace'] as const)('does not notify an owner changed by onPageScroll: %s', (action) => {
    const next = { onReachBottom: vi.fn() }
    page.onPageScroll.mockImplementation(() => {
      entry.active = false
      setEntryScrollOwner(entry, false)
      if (action === 'replace') {
        setEntryScrollOwner(createEntry(next), true)
      }
    })
    container.scrollTop = 700
    expect(() => recordActiveEntryScrollPosition()).not.toThrow()
    expect(page.onReachBottom).not.toHaveBeenCalled()
    expect(next.onReachBottom).not.toHaveBeenCalled()
  })

  it('records the boundary before a reach-bottom callback reenters scrolling', () => {
    page.onReachBottom.mockImplementation(() => recordActiveEntryScrollPosition())
    scroll(700)
    expect(page.onReachBottom).toHaveBeenCalledTimes(1)
  })

  it.each([0, 200, 300])('stays idle when content height %i does not scroll', (height) => {
    container.scrollHeight = height
    scroll(0)
    expect(page.onReachBottom).not.toHaveBeenCalled()
  })
})
