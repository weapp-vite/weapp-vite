import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createSelectorQueryBridge,
  resolveSelectorTargets,
} from '../src/runtime/polyfill/selectorQuery'

function createRoot(entries: Record<string, unknown[]> = {}) {
  return {
    querySelector: vi.fn((selector: string) => entries[selector]?.[0] ?? null),
    querySelectorAll: vi.fn((selector: string) => entries[selector] ?? []),
  }
}

describe('web selector query capability matrix', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('resolves shadow, public element, current page and document query roots', () => {
    const probe = { id: 'probe' }
    const directShadow = createRoot({ '.probe': [probe] })
    expect(resolveSelectorTargets({ shadowRoot: directShadow }, '.probe')).toEqual([probe])

    const publicShadow = createRoot({ '.probe': [probe] })
    expect(resolveSelectorTargets({ $el: { shadowRoot: publicShadow } }, '.probe')).toEqual([probe])

    const publicRenderRoot = createRoot({ '.probe': [probe] })
    expect(resolveSelectorTargets({ $el: { renderRoot: publicRenderRoot } }, '.probe')).toEqual([probe])

    const publicRoot = createRoot({ '.probe': [probe] })
    expect(resolveSelectorTargets({ $el: publicRoot }, '.probe')).toEqual([probe])

    const directRoot = createRoot({ '.probe': [probe] })
    expect(resolveSelectorTargets(directRoot, '.probe')).toEqual([probe])
    expect(resolveSelectorTargets(directRoot, '.probe', true)).toEqual([probe])

    const pageRoot = createRoot({ '.page': [probe] })
    vi.stubGlobal('getCurrentPages', () => [{ renderRoot: pageRoot }])
    expect(resolveSelectorTargets(undefined, '.page')).toEqual([probe])

    vi.stubGlobal('getCurrentPages', undefined)
    const documentRoot = createRoot({ '.document': [probe] })
    vi.stubGlobal('document', documentRoot)
    expect(resolveSelectorTargets(undefined, '.document')).toEqual([probe])
    expect(resolveSelectorTargets({}, '.missing')).toEqual([])

    vi.stubGlobal('document', undefined)
    expect(resolveSelectorTargets(null, '.missing')).toEqual([])
  })

  it('walks ancestor roots without looping and falls back to the current page', () => {
    const probe = { id: 'ancestor' }
    const emptyRoot = createRoot()
    const ancestorRoot = createRoot()
    const nextRoot = createRoot({ '.ancestor': [probe] })
    ;(ancestorRoot as any).host = { getRootNode: () => nextRoot }
    const host = { getRootNode: () => ancestorRoot }
    expect(resolveSelectorTargets({ $: {}, $el: host, renderRoot: emptyRoot }, '.ancestor')).toEqual([probe])

    ;(ancestorRoot as any).host = { getRootNode: () => ancestorRoot }
    const pageProbe = { id: 'page' }
    const pageRoot = createRoot({ '.page': [pageProbe] })
    vi.stubGlobal('getCurrentPages', () => [{ shadowRoot: pageRoot }])
    expect(resolveSelectorTargets({ $: {}, $el: host, renderRoot: emptyRoot }, '.page')).toEqual([pageProbe])

    vi.stubGlobal('getCurrentPages', () => [{ renderRoot: emptyRoot }])
    expect(resolveSelectorTargets({ $: {}, $el: host, renderRoot: emptyRoot }, '.missing')).toEqual([])
    expect(resolveSelectorTargets({ $: {}, $el: {}, renderRoot: emptyRoot }, '.missing')).toEqual([])
    expect(resolveSelectorTargets({ renderRoot: emptyRoot }, '.missing')).toEqual([])
  })

  it('returns complete field, node, rect, scroll and viewport results', () => {
    class FakeElement {
      attributes: unknown[] = []
      childNodes: unknown[] = []
      dataset?: Record<string, string>
      id?: string
      scrollLeft?: number
      scrollTop?: number
      tagName = 'DIV'
      title?: string

      constructor(values: Partial<FakeElement> = {}) {
        Object.assign(this, values)
      }

      getAttribute(name: string) {
        return name === 'id' ? 'attribute-id' : null
      }

      getAttributeNames() {
        return []
      }

      getBoundingClientRect(): any {
        return {
          left: Number.NaN,
          top: 5,
          width: 20,
          height: Number.NaN,
        }
      }
    }
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (key: string) => key === 'color' ? 'rgb(1, 2, 3)' : '',
    }))
    vi.stubGlobal('window', {
      innerHeight: 667,
      innerWidth: 375,
      scrollX: 7,
      scrollY: 11,
    })

    const first = new FakeElement({
      dataset: { role: 'first' },
      scrollLeft: Number.NaN,
      scrollTop: 12,
      title: 'First',
    })
    const second = new FakeElement({ id: 'second' })
    second.getBoundingClientRect = () => ({
      bottom: 24,
      height: 20,
      left: 2,
      right: 12,
      top: 4,
      width: 10,
    })
    const withoutRect = { dataset: undefined, title: 'Plain' }
    const root = createRoot({
      '.items': [first, second],
      '.null': [null],
      '.plain': [withoutRect],
    })
    const fieldCallback = vi.fn()
    const nodeCallback = vi.fn()
    const execCallback = vi.fn()
    const query = createSelectorQueryBridge().in(root)
    query.selectAll('.items').boundingClientRect()
    query.select('.items').scrollOffset()
    query.select('.items').fields({
      computedStyle: ['color'],
      context: true,
      dataset: true,
      id: true,
      node: true,
      properties: ['title'],
      rect: true,
      scrollOffset: true,
      size: true,
    }, fieldCallback)
    query.select('.items').node(nodeCallback)
    query.select('.plain').fields({ computedStyle: ['color'], dataset: true, rect: true, size: true })
    query.select('.missing').boundingClientRect()
    query.selectAll('.missing').node()
    query.selectViewport().boundingClientRect()
    query.selectViewport().scrollOffset()
    query.selectAll('.null').boundingClientRect()
    query.selectAll('.null').fields({})
    query.select('.plain').fields({ id: true })
    query.select('.items').fields({ size: true })
    query.select('.items').fields({ rect: true })
    expect(query.exec(execCallback)).toBe(query)

    expect(fieldCallback).toHaveBeenCalledTimes(1)
    const fields = fieldCallback.mock.calls[0]?.[0]
    expect(fields).toMatchObject({
      bottom: 5,
      color: 'rgb(1, 2, 3)',
      dataset: { role: 'first' },
      height: 0,
      id: 'attribute-id',
      left: 0,
      right: 20,
      scrollLeft: 0,
      scrollTop: 12,
      title: 'First',
      top: 5,
      width: 20,
    })
    expect(fields.context).toBe(first)
    expect(fields.node).toBe(first)
    expect(nodeCallback).toHaveBeenCalledTimes(1)
    expect(nodeCallback.mock.calls[0]?.[0]?.node).toBe(first)
    const results = execCallback.mock.calls[0]?.[0]
    expect(results[0]).toEqual([
      { bottom: 5, height: 0, left: 0, right: 20, top: 5, width: 20 },
      { bottom: 24, height: 20, left: 2, right: 12, top: 4, width: 10 },
    ])
    expect(results[4]).toEqual({ dataset: {} })
    expect(results[5]).toBeNull()
    expect(results[6]).toEqual([])
    expect(results[7]).toEqual({ bottom: 667, height: 667, left: 0, right: 375, top: 0, width: 375 })
    expect(results[8]).toEqual({ scrollLeft: 7, scrollTop: 11 })
    expect(results[9]).toEqual([null])
    expect(results[10]).toEqual([null])
    expect(results[11]).toEqual({ id: '' })
    expect(results[12]).toEqual({ height: 0, width: 20 })
    expect(results[13]).toEqual({ bottom: 5, left: 0, right: 20, top: 5 })
  })

  it('handles unavailable viewport, invalid roots and updateComplete candidates', async () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    vi.stubGlobal('getCurrentPages', () => [])
    let callback = vi.fn()
    createSelectorQueryBridge()
      .selectViewport()
      .boundingClientRect(callback)
      .select('')
      .node()
      .exec()
    expect(callback).toHaveBeenCalledWith(null)

    const root = createRoot({ '.global': [globalThis] })
    vi.stubGlobal('pageXOffset', undefined)
    vi.stubGlobal('pageYOffset', undefined)
    vi.stubGlobal('scrollX', 9)
    vi.stubGlobal('scrollY', 13)
    callback = vi.fn()
    createSelectorQueryBridge()
      .in({ renderRoot: root, updateComplete: 'ready' })
      .select('.global')
      .scrollOffset(callback)
      .select('.global')
      .boundingClientRect()
      .exec()
    expect(callback).toHaveBeenCalledWith({ scrollLeft: 9, scrollTop: 13 })

    const noThenCallback = vi.fn()
    createSelectorQueryBridge()
      .in({ renderRoot: root, updateComplete: {} })
      .select('.global')
      .node(noThenCallback)
      .exec()
    expect(noThenCallback).toHaveBeenCalledWith({ node: globalThis })

    let resolveUpdate!: () => void
    const updateComplete = new Promise<void>((resolve) => {
      resolveUpdate = resolve
    })
    const deferred = vi.fn()
    createSelectorQueryBridge()
      .in({ renderRoot: root, updateComplete })
      .select('.global')
      .node(deferred)
      .exec()
    expect(deferred).not.toHaveBeenCalled()
    resolveUpdate()
    await updateComplete
    await Promise.resolve()
    expect(deferred).toHaveBeenCalledWith({ node: globalThis })
  })
})
