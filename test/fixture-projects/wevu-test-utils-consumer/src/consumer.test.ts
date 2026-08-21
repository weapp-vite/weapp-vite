import { mountComponent } from '@wevu/test-utils'
import { describe, expect, it } from 'vitest'
import ConsumerProbe from './pages/home/components/ConsumerProbe.vue'

describe('@wevu/test-utils public consumer', () => {
  it('isolates concurrently mounted compiled SFC components', async () => {
    const cleanups: string[] = []
    const createPlugin = (name: string) => ({
      install(app: { onUnmount: (cleanup: () => void) => void }) {
        app.onUnmount(() => cleanups.push(name))
      },
    })
    const first = mountComponent(ConsumerProbe, {
      props: { value: 2 },
      global: {
        mocks: { $consumerName: 'first' },
        plugins: [createPlugin('first')],
        provide: { 'consumer-source': 'first' },
      },
    })
    const second = mountComponent(ConsumerProbe, {
      props: { value: 3 },
      global: {
        mocks: { $consumerName: 'second' },
        plugins: [createPlugin('second')],
        provide: { 'consumer-source': 'second' },
      },
    })

    expect(first.vm.source).toBe('first')
    expect(first.vm.$consumerName).toBe('first')
    expect(first.vm.doubled.value).toBe(4)
    expect(second.vm.source).toBe('second')
    expect(second.vm.$consumerName).toBe('second')
    expect(second.vm.doubled.value).toBe(6)

    await first.setProps({ value: 5 })
    expect(first.vm.doubled.value).toBe(10)
    expect(second.vm.doubled.value).toBe(6)

    second.unmount()
    expect(cleanups).toEqual(['second'])
    expect(second.emitted('closed')).toEqual([['second']])
    expect(first.isUnmounted).toBe(false)

    first.unmount()
    expect(cleanups).toEqual(['second', 'first'])
    expect(first.emitted('closed')).toEqual([['first']])
  })
})
