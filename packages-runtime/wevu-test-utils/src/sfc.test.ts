import { describe, expect, it, vi } from 'vitest'
import { inject, injectGlobal, watch } from 'wevu'
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

  it('isolates app context between live component wrappers', () => {
    const token = Symbol('isolated-component-token')
    const cleanup = vi.fn()
    const install = vi.fn((app: { onUnmount: (cleanup: () => void) => void }) => {
      app.onUnmount(cleanup)
    })
    const component = {
      setup() {
        return {
          injected: inject(token, 'missing'),
        }
      },
    }

    const first = mountComponent(component, {
      global: {
        mocks: { $mountName: 'first' },
        plugins: [{ install }],
        provide: { [token]: 'first' },
      },
    })
    expect(first.vm.injected).toBe('first')
    expect(first.vm.$mountName).toBe('first')

    const second = mountComponent(component, {
      global: {
        mocks: { $mountName: 'second' },
        plugins: [{ install }],
        provide: { [token]: 'second' },
      },
    })
    expect(second.vm.injected).toBe('second')
    expect(second.vm.$mountName).toBe('second')
    expect(first.vm.injected).toBe('first')
    expect(first.vm.$mountName).toBe('first')
    expect(() => injectGlobal(token)).toThrow('未找到对应 key')
    expect(install).toHaveBeenCalledTimes(2)

    second.unmount()
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(first.isUnmounted).toBe(false)
    expect(first.vm.$mountName).toBe('first')

    first.unmount()
    expect(cleanup).toHaveBeenCalledTimes(2)
  })

  it('does not reuse app context after every live wrapper is unmounted', () => {
    const token = Symbol('repeated-component-token')
    const installs: string[] = []
    const cleanups: string[] = []
    const component = {
      setup() {
        return {
          injected: inject(token, 'missing'),
        }
      },
    }

    const createPlugin = (name: string) => ({
      install(app: { onUnmount: (cleanup: () => void) => void }) {
        installs.push(name)
        app.onUnmount(() => cleanups.push(name))
      },
    })

    const first = mountComponent(component, {
      global: {
        mocks: { $mountName: 'first' },
        plugins: [createPlugin('first')],
        provide: { [token]: 'first' },
      },
    })
    first.unmount()
    first.unmount()

    const second = mountComponent(component, {
      global: {
        mocks: { $mountName: 'second' },
        plugins: [createPlugin('second')],
      },
    })

    expect(second.vm.injected).toBe('missing')
    expect(second.vm.$mountName).toBe('second')
    expect(installs).toEqual(['first', 'second'])
    expect(cleanups).toEqual(['first'])

    second.unmount()
    expect(cleanups).toEqual(['first', 'second'])
  })

  it('runs app cleanup when the component detached hook throws', () => {
    const cleanup = vi.fn()
    const wrapper = mountComponent({
      lifetimes: {
        detached() {
          throw new Error('detached failed')
        },
      },
      setup() {
        return { ready: true }
      },
    }, {
      global: {
        plugins: [{
          install(app: { onUnmount: (callback: () => void) => void }) {
            app.onUnmount(cleanup)
          },
        }],
      },
    })

    expect(() => wrapper.unmount()).toThrow('detached failed')
    expect(wrapper.isUnmounted).toBe(true)
    expect(cleanup).toHaveBeenCalledTimes(1)

    wrapper.unmount()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
