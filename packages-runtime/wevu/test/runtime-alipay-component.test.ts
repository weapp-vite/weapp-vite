import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, nextTick, onUnmounted, ref } from '@/index'
import { runInlineExpression } from '@/runtime/register/inline'

let definition: Record<string, any>

beforeEach(() => {
  vi.stubGlobal('my', {})
  vi.stubGlobal('Component', (options: Record<string, any>) => {
    definition = options
  })
})

afterEach(() => vi.unstubAllGlobals())

function createHost(props: Record<string, unknown> = {}) {
  return {
    ...definition.methods,
    props: { ...definition.props, ...props },
    data: { ...definition.data },
    setData(payload: Record<string, unknown>) {
      Object.assign(this.data, payload)
    },
  }
}

describe('Alipay component host adapter', () => {
  it('delivers emitted payloads through Alipay callbacks with the parent binding dataset', async () => {
    const received = vi.fn()
    defineComponent({
      setup(_props, { emit }) {
        return { change: () => emit('update:modelValue', 2) }
      },
    })
    const host = createHost({
      'data-wi-update-modelvalue': 'update',
      'data-wd-update-modelvalue': '1',
      'onUpdateModelvalue': (event: unknown) => runInlineExpression({}, undefined, event, {
        update: { keys: [], fn: (_ctx, _scope, value) => received(value) },
      }),
    })
    definition.onInit.call(host)
    definition.didMount.call(host)
    await nextTick()
    host.change()
    expect(received).toHaveBeenCalledExactlyOnceWith(2)
    delete host.props.onUpdateModelvalue
    expect(() => host.change()).not.toThrow()
    definition.didUnmount.call(host)
  })

  it('mounts computed props through native hooks and tracks parent updates before this.props changes', async () => {
    const unmounted = vi.fn()
    const local = ref(1)
    defineComponent({
      props: { platform: { type: String, default: 'unknown' } },
      setup(props) {
        onUnmounted(unmounted)
        return { platformLabel: computed(() => `${props.platform}:${local.value}`) }
      },
    })
    const host = createHost({ platform: 'alipay' })
    expect(definition.onInit).toBeTypeOf('function')
    definition.onInit.call(host)
    definition.didMount.call(host)
    await nextTick()
    expect(host.data.platformLabel).toBe('alipay:1')

    definition.deriveDataFromProps.call(host, { platform: 'updated' })
    await nextTick()
    expect(host.data.platformLabel).toBe('updated:1')
    expect(host.props.platform).toBe('alipay')
    definition.didUnmount.call(host)
    local.value = 2
    await nextTick()
    expect(unmounted).toHaveBeenCalledOnce()
    expect(host.data.platformLabel).toBe('updated:1')
  })

  it('keeps defaults and mounts a fresh runtime for each native component', async () => {
    const setup = vi.fn((props: { count: number }) => ({ doubled: computed(() => props.count * 2) }))
    defineComponent({ props: { count: { type: Number, default: 3 } }, setup })
    expect(definition.props).toMatchObject({ count: 3 })
    for (const count of [3, 4]) {
      const host = createHost({ count })
      definition.onInit.call(host)
      definition.didMount.call(host)
      await nextTick()
      expect(host.data.doubled).toBe(count * 2)
      definition.didUnmount.call(host)
    }
    expect(setup).toHaveBeenCalledTimes(2)
  })
})
