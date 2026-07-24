import type { PageRecord, PageStackEntry } from '../src/runtime/polyfill/routeRuntime/options'
import { describe, expect, it, vi } from 'vitest'

const runtimeSpies = vi.hoisted(() => ({
  destroyed: [] as string[],
  hidden: [] as string[],
  mounted: [] as string[],
  shown: [] as string[],
}))

vi.mock('../src/runtime/polyfill/routeRuntime/dom', () => ({
  captureEntryScrollPosition() {},
  mountEntryToDom(entry: PageStackEntry, _registry: Map<string, PageRecord>, onMounted: (entry: PageStackEntry) => void) {
    runtimeSpies.mounted.push(entry.id)
    entry.element = { remove() {} } as unknown as PageStackEntry['element']
    entry.instance = {} as PageStackEntry['instance']
    onMounted(entry)
  },
  restoreEntryScrollPosition() {},
  setEntryActiveInDom(entry: PageStackEntry, active: boolean) {
    entry.active = active
  },
  unmountEntryFromDom(entry: PageStackEntry) {
    runtimeSpies.destroyed.push(entry.id)
    entry.element = undefined
    entry.instance = undefined
  },
}))

vi.mock('../src/runtime/polyfill/routeRuntime/lifecycle', () => ({
  hidePageInstance(_instance: unknown, record: PageRecord) {
    runtimeSpies.hidden.push(record.tag)
  },
  showPageInstance(_instance: unknown, record: PageRecord) {
    runtimeSpies.shown.push(record.tag)
  },
}))

describe('PageStackRuntime tabBar ownership', async () => {
  const { PageStackRuntime } = await import('../src/runtime/polyfill/routeRuntime/stack')

  it('caches tab pages while unloading non-tab pages', () => {
    const registry = new Map<string, PageRecord>([
      ['pages/home/index', { tag: 'home', hooks: {}, instances: new Set() }],
      ['pages/settings/index', { tag: 'settings', hooks: {}, instances: new Set() }],
      ['pages/detail/index', { tag: 'detail', hooks: {}, instances: new Set() }],
    ])
    const stack = new PageStackRuntime(registry, () => {})
    stack.configureTabPages(['pages/home/index', 'pages/settings/index'])

    expect(stack.push('pages/home/index', {})).toBe(true)
    expect(stack.push('pages/detail/index', { from: 'home' })).toBe(true)
    expect(stack.switchTab('pages/settings/index', {})).toBe(true)
    expect(stack.entries.map(entry => entry.id)).toEqual(['pages/settings/index'])
    expect(runtimeSpies.destroyed).toContain('pages/detail/index')
    expect(runtimeSpies.destroyed).not.toContain('pages/home/index')

    expect(stack.switchTab('pages/home/index', { restored: '1' })).toBe(true)
    expect(stack.entries).toHaveLength(1)
    expect(stack.entries[0]).toMatchObject({
      id: 'pages/home/index',
      query: { restored: '1' },
      active: true,
    })
    expect(runtimeSpies.mounted.filter(id => id === 'pages/home/index')).toHaveLength(1)
    expect(runtimeSpies.shown).toContain('home')

    const shownBeforeRepeat = runtimeSpies.shown.length
    expect(stack.switchTab('pages/home/index', {})).toBe(true)
    expect(runtimeSpies.shown).toHaveLength(shownBeforeRepeat + 1)
    expect(stack.switchTab('pages/detail/index', {})).toBe(false)
  })

  it('destroys cached tabs when relaunching', () => {
    runtimeSpies.destroyed.length = 0
    const registry = new Map<string, PageRecord>([
      ['pages/home/index', { tag: 'home', hooks: {}, instances: new Set() }],
      ['pages/settings/index', { tag: 'settings', hooks: {}, instances: new Set() }],
      ['pages/detail/index', { tag: 'detail', hooks: {}, instances: new Set() }],
    ])
    const stack = new PageStackRuntime(registry, () => {})
    stack.configureTabPages(['pages/home/index', 'pages/settings/index'])
    stack.push('pages/home/index', {})
    stack.switchTab('pages/settings/index', {})

    expect(stack.relaunch('pages/detail/index', {})).toBe(true)
    expect(new Set(runtimeSpies.destroyed)).toEqual(new Set([
      'pages/home/index',
      'pages/settings/index',
    ]))
    expect(stack.entries.map(entry => entry.id)).toEqual(['pages/detail/index'])
  })
})
