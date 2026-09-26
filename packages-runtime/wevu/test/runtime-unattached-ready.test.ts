import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from '@/index'

afterEach(() => vi.unstubAllGlobals())

describe('runtime: ready before attachment', () => {
  it('does not mount a discarded conditional branch when the host sends ready', () => {
    let definition: any
    vi.stubGlobal('Component', (options: unknown) => {
      definition = options
    })
    const created = vi.fn()
    const mounted = vi.fn()
    const nativeReady = vi.fn()
    const computed = vi.fn(function (this: { text: string }) {
      return this.text.split('')
    })
    defineComponent({
      props: { text: { type: String, default: '' } },
      computed: { letters: computed },
      created,
      mounted,
      lifetimes: { ready: nativeReady },
    })
    const instance: any = {
      data: {},
      properties: { text: '' },
      setData: vi.fn(),
      triggerEvent: vi.fn(),
    }
    definition.lifetimes.created.call(instance)
    // 微信会向创建后被 v-if 替换的分支发送 ready，但不会发送 attached。
    instance.properties.text = ['column notice']
    computed.mockClear()
    expect(() => definition.lifetimes.ready.call(instance)).not.toThrow()
    expect(nativeReady).toHaveBeenCalledOnce()
    expect(created).not.toHaveBeenCalled()
    expect(mounted).not.toHaveBeenCalled()
    expect(computed).not.toHaveBeenCalled()
    expect(instance.setData).not.toHaveBeenCalled()
  })

  it('runs Vue mounted normally after the host attaches the component', () => {
    let definition: any
    vi.stubGlobal('Component', (options: unknown) => {
      definition = options
    })
    const mounted = vi.fn()
    defineComponent({ mounted })
    const instance: any = { data: {}, properties: {}, setData: vi.fn(), triggerEvent: vi.fn() }
    definition.lifetimes.created.call(instance)
    definition.lifetimes.attached.call(instance)
    definition.lifetimes.ready.call(instance)
    expect(mounted).toHaveBeenCalledOnce()
  })
})
