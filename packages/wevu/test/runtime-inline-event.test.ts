import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from '@/index'

const registeredComponents: Record<string, any>[] = []

;(globalThis as any).Component = (options: Record<string, any>) => {
  registeredComponents.push(options)
}

describe('runtime: inline event handler', () => {
  it('executes inline expression with $event and keeps native event as arg', () => {
    const handle = vi.fn((msg: string, evt: any) => ({ msg, marker: evt.marker }))

    defineComponent({
      data: () => ({}),
      methods: {
        handle,
      },
      setup() {
        return {}
      },
    })

    const opts = registeredComponents.pop()
    expect(opts).toBeTruthy()
    const inst: any = {
      __wevu: {
        proxy: {
          handle,
        },
      },
    }
    const event = {
      marker: 42,
      currentTarget: {
        dataset: {
          wvHandler: 'handle',
          wvArgs: '["ok","$event"]',
        },
      },
    }

    const result = opts.methods.__weapp_vite_inline.call(inst, event)
    expect(handle).toHaveBeenCalledWith('ok', event)
    expect(result).toEqual({ msg: 'ok', marker: 42 })
  })

  it('returns undefined when handler missing', () => {
    defineComponent({
      data: () => ({}),
      setup() {
        return {}
      },
    })
    const opts = registeredComponents.pop()
    const inst: any = { __wevu: { proxy: {} } }
    const event = {
      currentTarget: {
        dataset: {
          wvHandler: 'notFound',
          wvArgs: '["$event"]',
        },
      },
    }
    const result = opts.methods.__weapp_vite_inline.call(inst, event)
    expect(result).toBeUndefined()
  })
})
