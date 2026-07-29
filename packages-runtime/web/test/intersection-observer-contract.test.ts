// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createIntersectionObserverBridge } from '../src/runtime/polyfill/intersectionObserver'

function createRect(left: number, top: number, width: number, height: number) {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
  } as DOMRect
}

describe('intersection observer bridge contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.replaceChildren()
  })

  it('uses the microtask fallback and filters non-observable selector results', async () => {
    const first = document.createElement('div')
    first.id = 'first'
    first.dataset.state = 'ready'
    first.getBoundingClientRect = () => createRect(1, 2, 30, 40)
    const second = document.createElement('div')
    second.id = 'second'
    second.getBoundingClientRect = () => createRect(5, 6, 10, 20)
    const elementLike = {
      getBoundingClientRect: () => createRect(0, 0, 1, 1),
    }
    const scope = {
      querySelector: vi.fn(() => first),
      querySelectorAll: vi.fn(() => [null, {}, first, second, elementLike]),
    }
    vi.stubGlobal('IntersectionObserver', undefined)
    const callback = vi.fn()

    const observer = createIntersectionObserverBridge(scope, { observeAll: true })
      .relativeTo('.missing', { bottom: Number.NaN })
      .relativeToViewport()
      .observe('.target', callback)
    await Promise.resolve()

    expect(callback).toHaveBeenCalledTimes(3)
    expect(callback).toHaveBeenNthCalledWith(1, {
      boundingClientRect: createRect(1, 2, 30, 40),
      dataset: { state: 'ready' },
      id: 'first',
      intersectionRatio: 1,
      intersectionRect: createRect(1, 2, 30, 40),
      relativeRect: null,
      time: expect.any(Number),
    })
    expect(observer.disconnect()).toBeUndefined()
  })

  it('configures native roots, margins, thresholds, entries, and disconnect', () => {
    const root = document.createElement('div')
    root.className = 'root'
    const target = document.createElement('div')
    target.className = 'target'
    target.id = 'observed'
    target.dataset.kind = 'demo'
    document.body.append(root, target)
    const observe = vi.fn()
    const disconnect = vi.fn()
    let nativeCallback: IntersectionObserverCallback | undefined
    let nativeInit: IntersectionObserverInit | undefined
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback, init?: IntersectionObserverInit) {
        nativeCallback = callback
        nativeInit = init
      }

      observe = observe
      disconnect = disconnect
    })
    const callback = vi.fn()

    const observer = createIntersectionObserverBridge(document, { thresholds: [-1, 2] })
      .relativeTo('.root', { bottom: 4, left: 1, right: Number.NaN, top: 2 })
      .observe('.target', callback)

    expect(nativeInit).toEqual({
      root,
      rootMargin: '2px 0px 4px 1px',
      threshold: [0],
    })
    expect(observe).toHaveBeenCalledWith(target)
    nativeCallback!([{
      boundingClientRect: createRect(1, 2, 3, 4),
      intersectionRatio: 0.5,
      intersectionRect: null,
      isIntersecting: true,
      rootBounds: createRect(0, 0, 100, 100),
      target,
      time: 12,
    } as unknown as IntersectionObserverEntry, {
      boundingClientRect: createRect(0, 0, 1, 1),
      intersectionRatio: 0,
      intersectionRect: createRect(0, 0, 0, 0),
      rootBounds: null,
      target: {
        getAttribute: vi.fn(() => null),
      },
      time: 13,
    } as unknown as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(callback).toHaveBeenCalledWith({
      boundingClientRect: createRect(1, 2, 3, 4),
      dataset: { kind: 'demo' },
      id: 'observed',
      intersectionRatio: 0.5,
      intersectionRect: null,
      relativeRect: createRect(0, 0, 100, 100),
      time: 12,
    })

    observer.disconnect()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it('uses initial ratio and null root when a relative selector is not observable', () => {
    let nativeInit: IntersectionObserverInit | undefined
    vi.stubGlobal('IntersectionObserver', class {
      constructor(_callback: IntersectionObserverCallback, init?: IntersectionObserverInit) {
        nativeInit = init
      }

      observe() {}
      disconnect() {}
    })
    const scope = {
      querySelector: vi.fn((selector: string) => selector === '.root' ? {} : null),
      querySelectorAll: vi.fn(() => []),
    }

    createIntersectionObserverBridge(scope, { initialRatio: Number.NaN })
      .relativeTo('.root')
      .observe('.missing', vi.fn())

    expect(nativeInit).toEqual({
      root: null,
      rootMargin: '0px 0px 0px 0px',
      threshold: [0],
    })
  })
})
