// @vitest-environment happy-dom

import type { PageRecord, PageStackEntry } from '../src/runtime/polyfill/routeRuntime/options'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  mountEntryToDom,
  setEntryActiveInDom,
  unmountEntryFromDom,
} from '../src/runtime/polyfill/routeRuntime/dom'

const runtime = vi.hoisted(() => ({
  attachRouteMeta: vi.fn(),
  bindPageScrollOwner: vi.fn(),
  container: undefined as HTMLElement | undefined,
  onDocumentReady: vi.fn((callback: () => void) => callback()),
  restoreEntryScrollPosition: vi.fn(),
  setEntryScrollOwner: vi.fn(),
}))

vi.mock('../src/runtime/appShell/container', () => ({
  ensureAppContainer: () => runtime.container,
  onDocumentReady: runtime.onDocumentReady,
}))

vi.mock('../src/runtime/polyfill/routeRuntime/lifecycle', () => ({
  attachRouteMeta: runtime.attachRouteMeta,
}))

vi.mock('../src/runtime/polyfill/routeRuntime/scroll', () => ({
  bindPageScrollOwner: runtime.bindPageScrollOwner,
  restoreEntryScrollPosition: runtime.restoreEntryScrollPosition,
  setEntryScrollOwner: runtime.setEntryScrollOwner,
}))

function createRecord(tag = 'weapp-page-route-contract'): PageRecord {
  return { hooks: {}, instances: new Set(), tag }
}

function createEntry(active = true): PageStackEntry {
  return { active, id: 'pages/home/index', query: { source: 'contract' } }
}

describe('route DOM contract', () => {
  afterEach(() => {
    document.body.replaceChildren()
    runtime.container = undefined
    vi.clearAllMocks()
  })

  it('applies active and hidden page styles without preserving stale display rules', () => {
    const entry = createEntry()
    setEntryActiveInDom(entry, false)

    const unstyled = createEntry()
    unstyled.element = document.createElement('section') as PageStackEntry['element']
    setEntryActiveInDom(unstyled, true)
    expect(unstyled.element?.getAttribute('style')).toBe('display:block;')

    const element = document.createElement('section') as PageStackEntry['element']
    element!.setAttribute('style', 'color:red;display:flex;')
    entry.element = element
    setEntryActiveInDom(entry, false)
    expect(element!.getAttribute('style')).toBe('color:red;display:none;')
    expect(element!.getAttribute('hidden')).toBe('')
    expect(element!.getAttribute('aria-hidden')).toBe('true')

    element!.setAttribute('style', 'display:none;')
    setEntryActiveInDom(entry, true)
    expect(element!.getAttribute('style')).toBe('display:block;')
    expect(element!.hasAttribute('hidden')).toBe(false)
    expect(element!.hasAttribute('aria-hidden')).toBe(false)
    expect(runtime.setEntryScrollOwner).toHaveBeenCalledWith(entry, true)
  })

  it('unmounts attached, detached and empty entries', () => {
    const empty = createEntry()
    empty.instance = { detached: true } as any
    unmountEntryFromDom(empty)
    expect(empty.instance).toBeUndefined()

    const detached = createEntry()
    detached.element = document.createElement('div') as PageStackEntry['element']
    unmountEntryFromDom(detached)
    expect(detached.element).toBeUndefined()

    const attached = createEntry()
    attached.element = document.createElement('div') as PageStackEntry['element']
    document.body.append(attached.element!)
    unmountEntryFromDom(attached)
    expect(document.body.children).toHaveLength(0)
  })

  it('mounts registered pages in callback order and skips invalid states', () => {
    const registry = new Map<string, PageRecord>([['pages/home/index', createRecord()]])
    const beforeMount = vi.fn()

    mountEntryToDom({ active: true, id: 'pages/missing', query: {} }, registry, beforeMount)
    const existing = createEntry()
    existing.element = document.createElement('div') as PageStackEntry['element']
    mountEntryToDom(existing, registry, beforeMount)

    const withoutContainer = createEntry()
    mountEntryToDom(withoutContainer, registry, beforeMount)
    expect(withoutContainer.element).toBeUndefined()

    runtime.container = document.createElement('main')
    document.body.append(runtime.container)
    const active = createEntry()
    mountEntryToDom(active, registry, beforeMount)
    expect(beforeMount).toHaveBeenLastCalledWith(active)
    expect(runtime.bindPageScrollOwner).toHaveBeenCalledWith(runtime.container)
    expect(active.element?.parentNode).toBe(runtime.container)
    expect(active.element?.getAttribute('data-weapp-page')).toBe('pages/home/index')
    expect(runtime.attachRouteMeta).toHaveBeenCalledWith(active.element, {
      entry: active,
      id: active.id,
      query: active.query,
    })
    expect(runtime.restoreEntryScrollPosition).toHaveBeenCalledWith(active)

    runtime.restoreEntryScrollPosition.mockClear()
    const inactive = createEntry(false)
    mountEntryToDom(inactive, registry, beforeMount)
    expect(inactive.element?.getAttribute('hidden')).toBe('')
    expect(runtime.restoreEntryScrollPosition).not.toHaveBeenCalled()
  })
})
