import { describe, expect, it, vi } from 'vitest'
import { watch } from 'wevu'
import OptionsLogic from './fixtures/OptionsLogic.vue'
import { mount, mountComponent } from './index'

describe('Vue SFC logic mounting', () => {
  it('mounts script setup SFCs without global Component registration', async () => {
    const componentConstructor = vi.fn()
    vi.stubGlobal('Component', componentConstructor)

    try {
      const { default: SetupLogic } = await import('./fixtures/SetupLogic.vue')
      expect(componentConstructor).not.toHaveBeenCalled()
      const wrapper = mountComponent(SetupLogic, { props: { count: 2 } })
      expect(componentConstructor).not.toHaveBeenCalled()
      expect(wrapper.vm.doubled.value).toBe(4)
      expect(wrapper.vm.$props.count).toBe(2)
      expect(wrapper.emitted('ready')).toEqual([[4]])

      wrapper.vm.increment()
      await wrapper.nextTick()
      expect(wrapper.vm.doubled.value).toBe(6)
      expect(wrapper.emitted('change')).toEqual([[3]])

      await wrapper.setProps({ count: 5 })
      expect(wrapper.vm.localCount.value).toBe(5)
      expect(wrapper.vm.doubled.value).toBe(10)

      wrapper.unmount()
      expect(wrapper.emitted('closed')).toEqual([[undefined]])
    }
    finally {
      vi.unstubAllGlobals()
    }
  })

  it('auto-dispatches component options while preserving composable objects', () => {
    const componentWrapper = mount({
      props: { value: { type: Number, default: 2 } },
      setup(props: { value: number }) {
        return { value: props.value }
      },
    })
    expect(componentWrapper.vm.value).toBe(2)
    componentWrapper.unmount()

    const composableWrapper = mount({
      setup: () => ({ ready: true }),
    })
    expect(composableWrapper.vm.ready).toBe(true)
    composableWrapper.unmount()
  })

  it('mounts Options API data, computed, methods, watch, and provide/inject', async () => {
    const wrapper = mountComponent(OptionsLogic, {
      props: {},
      global: { provide: { token: 'provided' } },
    })
    expect(wrapper.vm.label).toBe('default-label')
    expect(wrapper.vm.upper).toBe('DEFAULT-LABEL')
    expect(wrapper.vm.injected).toBe('provided')
    expect(wrapper.vm.count).toBe(1)
    expect(wrapper.emitted('mounted')).toEqual([[undefined]])

    wrapper.vm.increment()
    await wrapper.nextTick()
    expect(wrapper.vm.count).toBe(2)

    await wrapper.setProps({ label: 'next' })
    expect(wrapper.vm.upper).toBe('NEXT')
    expect(wrapper.vm.count).toBe(3)
    wrapper.unmount()
    expect(wrapper.emitted('unmounted')).toEqual([[undefined]])
  })

  it('runs user prop observers before reactive watchers', async () => {
    const calls: string[] = []
    const wrapper = mountComponent({
      props: { value: { type: Number, default: 1 } },
      observers: {
        value(nextValue: number) {
          calls.push(`observer:${nextValue}`)
        },
      },
      setup(props: { value: number }) {
        watch(() => props.value, value => calls.push(`watch:${value}`))
      },
    })

    await wrapper.setProps({ value: 2 })
    expect(calls).toEqual(['observer:2', 'watch:2'])
    wrapper.unmount()
  })
})
