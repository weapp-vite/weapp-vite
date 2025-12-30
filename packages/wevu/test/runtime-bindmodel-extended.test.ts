import { describe, expect, it } from 'vitest'
import { createApp } from '@/index'

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

describe('runtime: bindModel variations', () => {
  it('default model() uses onInput and value, parser handles different shapes', async () => {
    const { adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ form: { name: 'a' } }),
    })
    const inst = app.mount(adapter)
    const binding = inst.bindModel<string>('form.name')
    const model = binding.model()
    expect(model.value).toBe('a')
    // 读取 detail.value
    model.onInput?.({ detail: { value: 'b' } })
    expect(inst.state.form.name).toBe('b')
    // 读取 target.value
    model.onInput?.({ target: { value: 'c' } })
    expect(inst.state.form.name).toBe('c')
    // 基础类型事件
    model.onInput?.('d')
    expect(inst.state.form.name).toBe('d')
  })

  it('custom event name and valueProp + formatter + parser', async () => {
    const { adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ v: 1 }),
    })
    const inst = app.mount(adapter)
    const binding = inst.bindModel<number>('v')
    const model = binding.model({
      event: 'change',
      valueProp: 'val',
      formatter: v => Number(v) * 10,
      parser: (e: any) => Number(e?.detail?.value ?? e) + 5,
    })
    expect(model.val).toBe(10)
    model.onChange?.({ detail: { value: 2 } })
    expect(inst.state.v).toBe(7)
  })
})
