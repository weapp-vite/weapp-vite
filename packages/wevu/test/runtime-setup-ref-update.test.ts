import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, ref } from '@/index'

const registeredComponents: Record<string, any>[] = []

beforeEach(() => {
  registeredComponents.length = 0
  ;(globalThis as any).Component = vi.fn((options: Record<string, any>) => {
    registeredComponents.push(options)
  })
})

describe('runtime: setup returned ref triggers setData', () => {
  it('updates snapshot when ref.value changes', async () => {
    defineComponent({
      data: () => ({}),
      setup() {
        const active = ref(true)
        function toggleActive() {
          active.value = !active.value
        }
        return {
          active,
          toggleActive,
        }
      },
    })

    const opts = registeredComponents[0]
    const setData = vi.fn()
    const inst: any = { setData }

    // 挂载
    opts.lifetimes.attached.call(inst)

    // 初始同步
    await Promise.resolve()

    const beforeCalls = setData.mock.calls.length
    inst.toggleActive()
    await Promise.resolve()

    expect(setData.mock.calls.length).toBeGreaterThan(beforeCalls)
    expect(setData).toHaveBeenCalledWith(expect.objectContaining({ active: false }))
  })

  it('patch 模式下 setup computed 返回对象时，回到初始引用仍会触发更新', async () => {
    defineComponent({
      data: () => ({}),
      setData: {
        strategy: 'patch',
      },
      setup() {
        const index = ref(0)
        const options = [
          { label: '选项1', value: 1 },
          { label: '选项2', value: 2 },
          { label: '选项3', value: 3 },
        ]
        const option = computed(() => options[index.value])
        function inc() {
          index.value += 1
        }
        function dec() {
          index.value -= 1
        }
        return {
          index,
          option,
          inc,
          dec,
        }
      },
    })

    const opts = registeredComponents[0]
    const setData = vi.fn()
    const inst: any = { setData }

    opts.lifetimes.attached.call(inst)
    await Promise.resolve()

    const normalizeCalls = () => setData.mock.calls.map(call => call?.[0] ?? {})

    inst.inc()
    await Promise.resolve()
    const firstBackfill = normalizeCalls().some(payload =>
      payload.index === 1 && payload['option.label'] === '选项2',
    )
    expect(firstBackfill).toBe(true)

    inst.dec()
    await Promise.resolve()
    const secondBackfill = normalizeCalls().some(payload =>
      payload.index === 0 && payload['option.label'] === '选项1',
    )
    expect(secondBackfill).toBe(true)
  })
})
