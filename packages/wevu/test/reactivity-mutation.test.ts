import type {
  MutationRecord,
} from '@/reactivity'
import { describe, expect, it } from 'vitest'
import {
  addMutationRecorder,
  markRaw,
  prelinkReactiveTree,
  reactive,
  removeMutationRecorder,
  shallowReactive,
} from '@/reactivity'
import { clearPatchIndices, isShallowReactive } from '@/reactivity/reactive'

describe('reactive mutation tracking', () => {
  it('records array and multi-parent mutations with fallbacks', () => {
    const records: MutationRecord[] = []
    const recorder = (record: MutationRecord) => {
      records.push(record)
    }
    addMutationRecorder(recorder)

    const shared: any = { value: 1 }
    const state = reactive({
      list: [{ value: 1 }],
      one: shared,
      two: shared,
    } as any)

    prelinkReactiveTree(state)

    state.list[0].value = 2
    ;(state.list as any)[''] = 3
    state.one.value = 4
    ;(state as any).__r_internal = 1
    const sym = Symbol('sym')
    ;(state as any)[sym] = { nested: true }

    removeMutationRecorder(recorder)

    expect(records.some(r => r.kind === 'array' && r.path === 'list')).toBe(true)
    expect(records.some(r => r.path === undefined && Array.isArray(r.fallbackTopKeys))).toBe(true)
  })

  it('handles prelink limits and clearPatchIndices', () => {
    const errors: string[] = []
    const stateWithDepth = reactive({
      keep: { value: 1 },
      list: [1, 2, 3],
    } as any)

    try {
      prelinkReactiveTree(stateWithDepth, { maxDepth: 0 })
    }
    catch (error) {
      errors.push(`maxDepth:${(error as Error).message}`)
    }

    const stateWithMaxKeys = reactive({
      keep: { value: 1 },
      list: [1, 2, 3],
    } as any)
    try {
      prelinkReactiveTree(stateWithMaxKeys, { maxKeys: 1 })
    }
    catch (error) {
      errors.push(`maxKeys:${(error as Error).message}`)
    }

    const stateWithFilter = reactive({
      keep: { value: 1 },
      skip: markRaw({ value: 2 }),
    } as any)
    try {
      prelinkReactiveTree(stateWithFilter, { shouldIncludeTopKey: key => key === 'keep' })
    }
    catch (error) {
      errors.push(`filter:${(error as Error).message}`)
    }

    try {
      clearPatchIndices(stateWithFilter)
      clearPatchIndices(stateWithFilter)
    }
    catch (error) {
      errors.push(`clear:${(error as Error).message}`)
    }

    expect(errors).toEqual([])
  })

  it('covers shallowReactive edge cases', () => {
    expect(shallowReactive(1 as any)).toBe(1)
    const base = {}
    const proxy = shallowReactive(base)
    expect(shallowReactive(base)).toBe(proxy)
    expect(shallowReactive(proxy)).toBe(proxy)
    expect(isShallowReactive(proxy)).toBe(true)

    delete (proxy as any).missing
  })
})
