import type { PageStackEntry } from '../src/runtime/polyfill/routeRuntime/options'
import {
  bindPageScrollOwner,
  disposePageScrollOwner,
  recordActiveEntryScrollPosition,
  restoreEntryScrollPosition,
  setEntryScrollOwner,
} from '../src/runtime/polyfill/routeRuntime/scroll'

class FakeScrollContainer extends EventTarget {
  scrollTop = 0
}

function entry(id: string): PageStackEntry {
  return { id, query: {}, active: true }
}

describe('page scroll ownership', () => {
  it('records user and programmatic scrolling on the active page only', () => {
    const previousDocument = globalThis.document
    const container = new FakeScrollContainer()
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        querySelector(selector: string) {
          return selector === '#app' ? container : null
        },
      },
    })

    try {
      const first = entry('pages/first/index')
      const second = entry('pages/second/index')
      bindPageScrollOwner(container as unknown as HTMLElement)
      setEntryScrollOwner(first, true)

      container.scrollTop = 72
      container.dispatchEvent(new Event('scroll'))
      expect(first.scrollTop).toBe(72)

      setEntryScrollOwner(first, false)
      setEntryScrollOwner(second, true)
      restoreEntryScrollPosition(second)
      expect(container.scrollTop).toBe(0)

      container.scrollTop = 128
      recordActiveEntryScrollPosition()
      expect(container.scrollTop).toBe(128)
      expect(second.scrollTop).toBe(128)
      expect(first.scrollTop).toBe(72)

      setEntryScrollOwner(second, false)
      setEntryScrollOwner(first, true)
      restoreEntryScrollPosition(first)
      expect(container.scrollTop).toBe(72)
    }
    finally {
      disposePageScrollOwner()
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: previousDocument,
      })
    }
  })
})
