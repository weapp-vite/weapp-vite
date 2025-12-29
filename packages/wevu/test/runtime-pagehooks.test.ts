import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, onSaveExitState } from '@/index'

const registeredPages: Record<string, any>[] = []
beforeEach(() => {
  registeredPages.length = 0
  ;(globalThis as any).Page = vi.fn((options: Record<string, any>) => {
    registeredPages.push(options)
  })
})
afterEach(() => {
  delete (globalThis as any).Page
})

describe('runtime: onSaveExitState hook', () => {
  it('returns value from wevu hook', () => {
    defineComponent({
      type: 'page',
      setup() {
        onSaveExitState(() => ({ hello: 'world' }))
      },
    })
    expect(registeredPages).toHaveLength(1)
    const pageOptions = registeredPages[0]
    const inst: any = {}
    pageOptions.onLoad.call(inst)
    const res = pageOptions.onSaveExitState.call(inst)
    expect(res).toMatchObject({ hello: 'world' })
  })
})
