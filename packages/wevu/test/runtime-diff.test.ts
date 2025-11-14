import { describe, expect, it } from 'vitest'
import { createApp, nextTick } from '@/index'

function createMockAdapter() {
  const calls: Record<string, any>[] = []
  return {
    calls,
    adapter: {
      setData(payload: Record<string, any>) {
        calls.push(payload)
      },
    },
  }
}

describe('runtime: diff snapshots deletion', async () => {
  it('emits null for removed nested keys', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({
        nested: {
          x: 1,
          y: 2,
        },
      }),
    })
    const inst = app.mount(adapter)
    expect(calls).toHaveLength(1)
    // delete x via replacing object
    ;(inst.state as any).nested = { y: 2 }
    await nextTick()
    expect(calls.at(-1)).toMatchObject({
      'nested.x': null,
    })
  })
})
