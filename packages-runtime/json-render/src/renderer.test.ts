import { describe, expect, it, vi } from 'vitest'
import { createJsonRenderer } from './renderer'
import { catalog, fixture, initial } from './testing/fixture'
import { validateRendererSpec } from './validation'

describe('public renderer contracts', () => {
  it('binds application-defined state and dispatches typed action params with no business field assumptions', async () => {
    const renderer = createJsonRenderer({
      catalog,
      spec: fixture(),
      initialState: initial,
      actions: { increment: ({ delta }, ctx) => ctx.setState('/count', ctx.state.count + delta) },
    })
    await renderer.dispatch({ id: 'search', name: 'input', value: 'camera' })
    expect(renderer.state.filters.query).toBe('camera')
    expect(renderer.tree.value?.children[0]?.props.value).toBe('camera')
    await renderer.dispatch({ id: 'button', name: 'press' })
    expect(renderer.tree.value?.children[1]?.props.value).toBe(3)
    renderer.setState('/enabled', false)
    expect(renderer.tree.value?.children.map(node => node.id)).toEqual(['search', 'button'])
    expect(await renderer.dispatch({ id: 'gauge', name: 'change', value: 9 })).toBe(false)
    renderer.dispose()
  })

  it('validates input and action payloads before calling handlers', async () => {
    const increment = vi.fn()
    const renderer = createJsonRenderer({ catalog, spec: fixture(), initialState: initial, actions: { increment } })
    expect(await renderer.dispatch({ id: 'search', name: 'input', value: 42 })).toBe(false)
    expect(renderer.state.filters.query).toBe('')
    const spec = fixture()
    if (spec.elements.button?.type === 'Button') {
      spec.elements.button.on = { press: { action: 'increment', params: { delta: { $state: '/filters/query' } } } }
    }
    expect(renderer.load(spec)).toBe(true)
    expect(await renderer.dispatch({ id: 'button', name: 'press' })).toBe(false)
    expect(increment).not.toHaveBeenCalled()
    expect(renderer.error.value).not.toBeNull()
    expect(() => renderer.setState('/__proto__/polluted', true)).toThrow()
    expect(() => renderer.setState('/missing', true)).toThrow('不存在')
    renderer.dispose()
  })

  it('deduplicates pending actions and prevents old completions from writing after load/dispose', async () => {
    let finish!: () => void
    const cleanup = vi.fn()
    const action = vi.fn(async (_params, ctx) => {
      ctx.onCleanup(cleanup)
      await new Promise<void>((resolve) => {
        finish = resolve
      })
      ctx.setState('/count', 99)
    })
    const renderer = createJsonRenderer({ catalog, spec: fixture(), initialState: initial, actions: { increment: action } })
    const request = renderer.dispatch({ id: 'button', name: 'press' })
    expect(await renderer.dispatch({ id: 'button', name: 'press' })).toBe(false)
    expect(action).toHaveBeenCalledTimes(1)
    expect(renderer.pending.value).toEqual(['button:increment'])
    renderer.load(fixture(), { ...initial, count: 7 })
    finish()
    expect(await request).toBe(false)
    expect(renderer.state.count).toBe(7)
    expect(cleanup).toHaveBeenCalledTimes(1)
    const late = renderer.dispatch({ id: 'button', name: 'press' })
    renderer.dispose()
    finish()
    expect(await late).toBe(false)
    expect(renderer.state.count).toBe(7)
    expect(renderer.pending.value).toEqual([])
  })

  it('validates component grammar and graph limits with configurable bounds', () => {
    const base = fixture()
    expect(() => validateRendererSpec({ ...base, repeat: {} }, catalog, initial)).toThrow()
    expect(() => validateRendererSpec({ root: 'unknown', elements: base.elements }, catalog, initial)).toThrow('引用不存在')
    const cyclic = fixture()
    cyclic.elements.root!.children!.push('root')
    expect(() => validateRendererSpec(cyclic, catalog, initial)).toThrow('循环引用')
    expect(() => validateRendererSpec(base, catalog, initial, { maxNodes: 3 })).toThrow('3')
    expect(() => validateRendererSpec(base, catalog, initial, { maxDepth: 1 })).toThrow('深度')
    expect(() => validateRendererSpec(base, catalog, initial, { maxDepth: 0 })).toThrow('正整数')
    const unknown = { root: 'unknown', elements: { unknown: { type: 'Unregistered', props: {} } } }
    expect(() => validateRendererSpec(unknown, catalog, initial)).toThrow('未注册组件')
    const unsupported = { ...base, elements: { ...base.elements, gauge: { type: 'Gauge', props: { value: { $computed: 'sum' } } } } }
    expect(() => validateRendererSpec(unsupported, catalog, initial)).toThrow('不支持的表达式')
  })

  it('invalidates older streams and retains the last valid spec on malformed input', () => {
    const renderer = createJsonRenderer({ catalog, spec: fixture(), initialState: initial, actions: { increment() {} } })
    const old = renderer.createStream()
    const stream = renderer.createStream()
    expect(old.push('{broken}')).toBe(false)
    expect(renderer.error.value).toBeNull()
    const before = JSON.stringify(renderer.spec.value)
    expect(stream.push('{broken}\n')).toBe(false)
    expect(JSON.stringify(renderer.spec.value)).toBe(before)
    expect(renderer.error.value).not.toBeNull()
    renderer.load(fixture())
    expect(renderer.error.value).toBeNull()
    renderer.dispose()
  })
})
