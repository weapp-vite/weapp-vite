import type { PageStackEntry } from '../src/runtime/polyfill/routeRuntime/options'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bindPageScrollOwner,
  disposePageScrollOwner,
  recordActiveEntryScrollPosition,
  restoreEntryScrollPosition,
  setEntryScrollOwner,
} from '../src/runtime/polyfill/routeRuntime/scroll'

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

function stubDocument(container: FakeScrollContainer) {
  const previousDocument = globalThis.document
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      querySelector(selector: string) {
        return selector === '#app' ? container : null
      },
    },
  })
  return () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: previousDocument,
    })
  }
}

describe('page onReachBottom', () => {
  afterEach(() => {
    disposePageScrollOwner()
    vi.restoreAllMocks()
  })

  it('reports the bottom once per approach and keeps onPageScroll order', () => {
    const container = new FakeScrollContainer()
    const calls: string[] = []
    const page = {
      onPageScroll: vi.fn(() => calls.push('onPageScroll')),
      onReachBottom: vi.fn(() => calls.push('onReachBottom')),
    }
    const restores = stubDocument(container)
    try {
      bindPageScrollOwner(container as unknown as HTMLElement)
      setEntryScrollOwner(createEntry(page), true)

      container.scrollTop = 650
      container.dispatchEvent(new Event('scroll'))
      expect(page.onReachBottom).toHaveBeenCalledTimes(1)
      expect(calls).toEqual(['onPageScroll', 'onReachBottom'])

      container.scrollTop = 700
      container.dispatchEvent(new Event('scroll'))
      expect(page.onReachBottom).toHaveBeenCalledTimes(1)

      container.scrollTop = 100
      container.dispatchEvent(new Event('scroll'))
      container.scrollTop = 700
      container.dispatchEvent(new Event('scroll'))
      expect(page.onReachBottom).toHaveBeenCalledTimes(2)
      expect(page.onPageScroll).toHaveBeenCalledTimes(4)
    }
    finally {
      restores()
    }
  })

  it('does not report while restoring a page that was left at the bottom', () => {
    const container = new FakeScrollContainer()
    const page = { onReachBottom: vi.fn() }
    const entry = createEntry(page)
    const restores = stubDocument(container)
    try {
      bindPageScrollOwner(container as unknown as HTMLElement)
      setEntryScrollOwner(entry, true)
      entry.scrollTop = 650

      restoreEntryScrollPosition(entry)
      recordActiveEntryScrollPosition()
      expect(page.onReachBottom).not.toHaveBeenCalled()

      container.scrollTop = 100
      recordActiveEntryScrollPosition()
      container.scrollTop = 700
      recordActiveEntryScrollPosition()
      expect(page.onReachBottom).toHaveBeenCalledTimes(1)
    }
    finally {
      restores()
    }
  })

  it('stays idle when the page content does not scroll', () => {
    const container = new FakeScrollContainer()
    container.scrollHeight = 200
    const page = { onReachBottom: vi.fn() }
    const restores = stubDocument(container)
    try {
      bindPageScrollOwner(container as unknown as HTMLElement)
      setEntryScrollOwner(createEntry(page), true)

      container.scrollTop = 0
      container.dispatchEvent(new Event('scroll'))
      expect(page.onReachBottom).not.toHaveBeenCalled()
    }
    finally {
      restores()
    }
  })
})
