import { describe, expect, it, vi } from 'vitest'
import { normalizeBehaviors } from '../src/runtime/component/behavior'

describe('component behavior normalization contract', () => {
  it('returns an empty result for a missing component', () => {
    expect(normalizeBehaviors(undefined)).toEqual({ component: undefined, warnings: [] })
  })

  it('merges every behavior field and composes lifecycle order', () => {
    const calls: string[] = []
    const first = {
      data: () => ({ first: 1 }),
      lifetimes: {
        attached() {
          calls.push('first:attached')
        },
        created() {
          calls.push('first:created')
        },
      },
      methods: { firstMethod: vi.fn() },
      observers: { first: vi.fn() },
      options: { virtualHost: true },
      pageLifetimes: {
        show() {
          calls.push('first:show')
        },
      },
      properties: { first: String },
      relations: { './first': { type: 'child' } },
    }
    const second = {
      data: { second: 2 },
      lifetimes: {
        created() {
          calls.push('second:created')
        },
        detached() {
          calls.push('second:detached')
        },
      },
      pageLifetimes: {
        hide() {
          calls.push('second:hide')
        },
        resize() {
          calls.push('second:resize')
        },
        show() {
          calls.push('second:show')
        },
      },
    }
    const component = {
      behaviors: [first, second],
      created() {
        calls.push('component:created')
      },
      data: { own: 3 },
      pageLifetimes: {
        show() {
          calls.push('component:show')
        },
      },
    }

    const result = normalizeBehaviors(component as any).component!
    expect(result.data).toEqual({ first: 1, second: 2, own: 3 })
    expect(result.properties).toEqual(first.properties)
    expect(result.methods).toEqual(first.methods)
    expect(result.observers).toEqual(first.observers)
    expect(result.options).toEqual(first.options)
    expect(result.relations).toEqual(first.relations)

    const instance = {} as any
    result.lifetimes!.created!.call(instance)
    result.lifetimes!.attached!.call(instance)
    result.lifetimes!.detached!.call(instance)
    result.pageLifetimes!.show!.call(instance)
    result.pageLifetimes!.hide!.call(instance)
    result.pageLifetimes!.resize!.call(instance, {} as any)
    expect(calls).toEqual([
      'first:created',
      'second:created',
      'component:created',
      'first:attached',
      'second:detached',
      'first:show',
      'second:show',
      'component:show',
      'second:hide',
      'second:resize',
    ])
  })

  it('warns for cycles, non-array behaviors, and non-object entries', () => {
    const cyclic: any = {}
    cyclic.behaviors = [cyclic]
    const cycleResult = normalizeBehaviors(cyclic)
    expect(cycleResult.warnings).toContain('[@weapp-vite/web] behaviors 存在循环引用，已跳过。')

    const invalidEntries = normalizeBehaviors({ behaviors: [null, 'named-behavior', []] } as any)
    expect(invalidEntries.warnings).toHaveLength(3)

    const invalidCollection = normalizeBehaviors({ behaviors: 'not-an-array' } as any)
    expect(invalidCollection.warnings).toEqual(['[@weapp-vite/web] behaviors 仅支持数组，已忽略。'])
    expect(normalizeBehaviors({ behaviors: false } as any).warnings).toEqual([])
  })

  it('ignores non-object data factory results and empty definitions', () => {
    const result = normalizeBehaviors({
      behaviors: [{ data: () => [] }, {}],
      data: () => null,
    } as any)

    expect(result.component).toEqual({})
    expect(result.warnings).toEqual([])
  })
})
