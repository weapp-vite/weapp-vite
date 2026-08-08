import type { PageRecord, PageStackEntry } from '../src/runtime/polyfill/routeRuntime/options'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeSpies = vi.hoisted(() => ({
  destroyed: [] as string[],
  hidden: [] as string[],
  mounted: [] as string[],
  recorded: [] as string[],
  restored: [] as string[],
  shown: [] as string[],
}))

vi.mock('../src/runtime/polyfill/routeRuntime/dom', () => ({
  mountEntryToDom(entry: PageStackEntry, _registry: Map<string, PageRecord>, onMounted: (entry: PageStackEntry) => void) {
    onMounted(entry)
    runtimeSpies.mounted.push(entry.id)
    entry.element = { remove() {} } as unknown as PageStackEntry['element']
    entry.instance = {} as PageStackEntry['instance']
  },
  setEntryActiveInDom(entry: PageStackEntry, active: boolean) {
    entry.active = active
  },
  unmountEntryFromDom(entry: PageStackEntry) {
    runtimeSpies.destroyed.push(entry.id)
    entry.element = undefined
    entry.instance = undefined
  },
}))

vi.mock('../src/runtime/polyfill/routeRuntime/scroll', () => ({
  captureEntryScrollPosition(entry: PageStackEntry) {
    runtimeSpies.recorded.push(entry.id)
  },
  restoreEntryScrollPosition(entry: PageStackEntry) {
    runtimeSpies.restored.push(entry.id)
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

  beforeEach(() => {
    for (const values of Object.values(runtimeSpies)) {
      values.length = 0
    }
  })

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

  it('covers invalid targets, empty stacks and tab cache reconfiguration', () => {
    const registry = new Map<string, PageRecord>([
      ['pages/home/index', { tag: 'home', hooks: {}, instances: new Set() }],
      ['pages/settings/index', { tag: 'settings', hooks: {}, instances: new Set() }],
      ['pages/detail/index', { tag: 'detail', hooks: {}, instances: new Set() }],
    ])
    const beforeMount = vi.fn()
    const stack = new PageStackRuntime(registry, beforeMount)

    expect(stack.push('pages/missing/index', {})).toBe(false)
    expect(stack.replace('pages/missing/index', {})).toBe(false)
    expect(stack.relaunch('pages/missing/index', {})).toBe(false)
    expect(stack.back()).toBe(false)

    expect(stack.replace('pages/home/index', { initial: '1' })).toBe(true)
    expect(stack.entries[0]?.query).toEqual({ initial: '1' })
    expect(stack.push('pages/detail/index', {})).toBe(true)
    expect(runtimeSpies.recorded).toContain('pages/home/index')
    expect(runtimeSpies.hidden).toContain('home')
    expect(stack.replace('pages/settings/index', {})).toBe(true)
    expect(runtimeSpies.destroyed).toContain('pages/detail/index')
    expect(stack.back()).toBe(true)
    expect(runtimeSpies.restored).toContain('pages/home/index')
    expect(runtimeSpies.shown).toContain('home')

    runtimeSpies.destroyed.length = 0
    stack.configureTabPages(['pages/home/index', 'pages/settings/index'])
    expect(stack.switchTab('pages/settings/index', {})).toBe(true)
    expect(stack.switchTab('pages/home/index', {})).toBe(true)
    stack.configureTabPages(['pages/settings/index'])
    expect(runtimeSpies.destroyed).not.toContain('pages/settings/index')
    stack.configureTabPages(['pages/home/index'])
    expect(runtimeSpies.destroyed).toContain('pages/settings/index')
    expect(beforeMount).toHaveBeenCalled()
  })

  it('tolerates registry removal between page lifecycle transitions', () => {
    const registry = new Map<string, PageRecord>([
      ['pages/home/index', { tag: 'home', hooks: {}, instances: new Set() }],
      ['pages/detail/index', { tag: 'detail', hooks: {}, instances: new Set() }],
    ])
    const stack = new PageStackRuntime(registry, () => {})
    stack.push('pages/home/index', {})
    registry.delete('pages/home/index')
    stack.push('pages/detail/index', {})
    expect(stack.back()).toBe(true)
    expect(runtimeSpies.hidden).not.toContain('home')
    expect(runtimeSpies.shown).not.toContain('home')
  })
})
