import { describe, expect, it } from 'vitest'
import { computed, inject, onMounted, onShow, onUnmounted, ref, watch } from 'wevu'
import { mountComposable } from './index'

describe('@wevu/test-utils', () => {
  it('does not register a test app through the host App constructor', () => {
    const appConstructor = vi.fn()
    vi.stubGlobal('App', appConstructor)

    try {
      const wrapper = mountComposable(() => ({ ready: true }))
      expect(appConstructor).not.toHaveBeenCalled()
      wrapper.unmount()
    }
    finally {
      vi.unstubAllGlobals()
    }
  })

  it('mounts a composable with real Wevu reactivity and lifecycle hooks', async () => {
    const lifecycle: string[] = []
    const wrapper = mountComposable((props, { emit }) => {
      const count = ref(props.initial)
      const doubled = computed(() => count.value * 2)

      onMounted(() => {
        lifecycle.push('mounted')
        emit('ready')
      })
      onShow(() => lifecycle.push('shown'))
      onUnmounted(() => {
        lifecycle.push('unmounted')
        emit('closed')
      })

      return {
        count,
        doubled,
        increment: () => {
          count.value += 1
        },
      }
    }, { props: { initial: 2 } })

    expect(wrapper.vm.count.value).toBe(2)
    expect(wrapper.vm.doubled.value).toBe(4)
    expect(lifecycle).toEqual(['mounted'])
    expect(wrapper.emitted('ready')).toEqual([[undefined]])

    wrapper.vm.increment()
    await wrapper.nextTick()

    expect(wrapper.vm.doubled.value).toBe(6)
    expect(wrapper.setDataCalls.length).toBeGreaterThan(1)

    await wrapper.triggerHook('onShow')
    expect(lifecycle).toContain('shown')

    wrapper.unmount()
    expect(wrapper.isUnmounted).toBe(true)
    expect(lifecycle[lifecycle.length - 1]).toBe('unmounted')
    expect(wrapper.emitted('closed')).toEqual([[undefined]])
  })

  it('supports app provides, plugins, mocks, and props updates', async () => {
    const token = Symbol('token')
    const plugin = {
      install(app: { provide: (key: PropertyKey, value: unknown) => unknown }) {
        app.provide(token, 'from-plugin')
      },
    }
    const observed: unknown[] = []
    const wrapper = mountComposable((props) => {
      const injected = inject(token)
      watch(() => props.value, value => observed.push(value), { immediate: true })
      return {
        injected,
        value: computed(() => props.value),
      }
    }, {
      props: { value: 1 },
      global: {
        provide: { [token]: 'from-global' },
        plugins: [plugin],
        mocks: { $testFlag: true },
      },
    })

    expect(wrapper.vm.injected).toBe('from-plugin')
    expect(wrapper.vm.$testFlag).toBe(true)
    expect(observed).toEqual([1])

    await wrapper.setProps({ value: 3 })
    expect(wrapper.vm.value.value).toBe(3)
    expect(observed).toEqual([1, 3])
  })

  it('isolates app provides between composable wrappers', () => {
    const token = Symbol('isolated-composable-token')
    const first = mountComposable(() => ({
      injected: inject(token, 'missing'),
    }), {
      global: {
        provide: { [token]: 'first' },
      },
    })

    expect(first.vm.injected).toBe('first')
    first.unmount()

    const second = mountComposable(() => ({
      injected: inject(token, 'missing'),
    }))

    expect(second.vm.injected).toBe('missing')
    second.unmount()
  })

  it('updates runtime data through the wrapper and records emitted details', async () => {
    const wrapper = mountComposable((_props, { emit }) => {
      const count = ref(0)
      return {
        count,
        send: (value: string) => emit('change', value),
      }
    }, { data: { label: 'initial' } })

    await wrapper.setData({ label: 'next' })
    expect(wrapper.host.data?.label).toBe('next')
    wrapper.vm.send('done')
    expect(wrapper.emitted('change')).toEqual([['done']])
  })

  it('stops reactive effects when unmounted', async () => {
    const observed: number[] = []
    const wrapper = mountComposable(() => {
      const count = ref(0)
      watch(count, value => observed.push(value))
      return { count }
    })

    wrapper.vm.count.value = 1
    await wrapper.nextTick()
    expect(observed).toEqual([1])

    wrapper.unmount()
    wrapper.vm.count.value = 2
    await wrapper.nextTick()
    expect(observed).toEqual([1])
  })
})
