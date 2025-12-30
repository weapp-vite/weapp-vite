import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, onSaveExitState } from '@/index'

const registeredComponents: Record<string, any>[] = []
beforeEach(() => {
  registeredComponents.length = 0
  ;(globalThis as any).Component = vi.fn((options: Record<string, any>) => {
    registeredComponents.push(options)
  })
})
afterEach(() => {
  delete (globalThis as any).Component
})

describe('runtime: onSaveExitState hook', () => {
  it('returns value from wevu hook', () => {
    defineComponent({
      features: {
        enableOnSaveExitState: true,
      },
      setup() {
        onSaveExitState(() => ({ hello: 'world' }))
      },
    })
    expect(registeredComponents).toHaveLength(1)
    const componentOptions = registeredComponents[0]
    const inst: any = {}
    componentOptions.lifetimes.attached.call(inst)
    const res = componentOptions.onSaveExitState.call(inst)
    expect(res).toMatchObject({ hello: 'world' })
  })
})
