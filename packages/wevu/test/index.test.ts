import { describe, expect, it } from 'vitest'
import { createApp, nextTick, ref, watch } from '@/index'

async function flushJobs() {
  await nextTick()
  await nextTick()
}

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

describe('runtime', () => {
  it('syncs reactive state to the adapter', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({
        count: 0,
        nested: {
          message: 'hello',
        },
      }),
      computed: {
        doubled(this: any) {
          return this.count * 2
        },
      },
      methods: {
        increment(this: any) {
          this.count += 1
        },
      },
    })

    const instance = app.mount(adapter)

    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({
      count: 0,
      nested: {
        message: 'hello',
      },
      doubled: 0,
    })

    instance.methods.increment()
    await flushJobs()
    expect(calls.at(-1)).toEqual({
      count: 1,
      nested: {
        message: 'hello',
      },
      doubled: 2,
    })

    instance.proxy.count = 5
    await flushJobs()
    expect(calls.at(-1)).toMatchObject({
      count: 5,
      doubled: 10,
    })
  })

  it('supports two-way bindings via bindModel', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({
        form: {
          name: 'alice',
        },
      }),
    })
    const instance = app.mount(adapter)
    expect(calls).toHaveLength(1)

    const binding = instance.bindModel<string>('form.name')

    expect(binding.value).toBe('alice')

    binding.value = 'bob'
    await flushJobs()
    expect(instance.state.form.name).toBe('bob')
    expect(calls.at(-1)?.form?.name).toBe('bob')

    const model = binding.model()
    model.onInput?.({ detail: { value: 'carol' } })
    await flushJobs()
    expect(binding.value).toBe('carol')
    expect(calls.at(-1)?.form?.name).toBe('carol')
  })

  it('allows writing to computed properties with setters', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({
        count: 1,
      }),
      computed: {
        label: {
          get(this: any) {
            return `count:${this.count}`
          },
          set(this: any, value: string) {
            const [, numberPart] = value.split(':')
            this.count = Number(numberPart)
          },
        },
      },
    })
    const instance = app.mount(adapter)
    expect(calls.at(-1)).toEqual({
      count: 1,
      label: 'count:1',
    })

    const binding = instance.bindModel('label')
    binding.value = 'count:8'
    await flushJobs()

    expect(instance.state.count).toBe(8)
    expect(instance.proxy.label).toBe('count:8')
    expect(calls.at(-1)).toEqual({
      count: 8,
      label: 'count:8',
    })
  })

  it('stops propagating updates after unmount', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({
        count: 0,
      }),
    })
    const instance = app.mount(adapter)
    expect(calls).toHaveLength(1)

    instance.unmount()
    instance.proxy.count = 10
    await flushJobs()

    expect(calls).toHaveLength(1)
  })
})

describe('reactivity primitives', () => {
  it('watch reacts to ref changes', async () => {
    const value = ref(1)
    const observed: number[] = []

    const stop = watch(value, (val) => {
      observed.push(val)
    }, { immediate: true })

    value.value = 2
    await flushJobs()

    value.value = 4
    await flushJobs()

    stop()

    expect(observed).toEqual([1, 2, 4])
  })
})
