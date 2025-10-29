import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'wevu'
import { createWevuComponent } from '@/runtime'

describe('createWevuComponent', () => {
  let pageDefinition: any

  beforeEach(() => {
    pageDefinition = undefined
  })

  afterEach(() => {
    delete (globalThis as any).Page
    delete (globalThis as any).Component
  })

  it('mounts runtime for pages and proxies methods', async () => {
    (globalThis as any).Page = vi.fn((definition: any) => {
      pageDefinition = definition
    })

    const watchSpy = vi.fn()
    const onShow = vi.fn()

    const pageOptions: any = {
      type: 'page',
      data() {
        return {
          count: 0,
        }
      },
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
      watch: {
        count: watchSpy,
      },
      onShow,
    }

    createWevuComponent(pageOptions)

    expect((globalThis as any).Page).toHaveBeenCalled()
    expect(pageDefinition).toBeTruthy()

    const instance: any = {
      data: {},
      setData: vi.fn(function (this: any, payload: Record<string, any>) {
        this.data = {
          ...this.data,
          ...payload,
        }
      }),
    }

    pageDefinition.onLoad.call(instance, {})
    await nextTick()
    expect(instance.$wevu).toBeDefined()
    expect(instance.data.count).toBe(0)
    expect(instance.data.doubled).toBe(0)

    pageDefinition.increment.call(instance)
    await nextTick()
    expect(instance.data.count).toBe(1)
    expect(instance.data.doubled).toBe(2)
    expect(watchSpy).toHaveBeenCalledWith(1, 0)

    pageDefinition.onShow.call(instance)
    expect(onShow).toHaveBeenCalled()

    pageDefinition.onUnload.call(instance)
    expect(instance.$wevu).toBeUndefined()
  })

  it('integrates with component lifetimes', async () => {
    let componentDefinition: any
    (globalThis as any).Component = vi.fn((definition: any) => {
      componentDefinition = definition
    })
    const componentOptions: any = {
      type: 'component',
      data() {
        return {
          message: 'hello',
        }
      },
      methods: {
        updateMessage(this: any, value: string) {
          this.message = value
        },
      },
      lifetimes: {
        attached: vi.fn(),
        detached: vi.fn(),
      },
    }
    createWevuComponent(componentOptions)

    expect((globalThis as any).Component).toHaveBeenCalled()
    expect(componentDefinition).toBeTruthy()

    const instance: any = {
      data: {},
      setData(this: any, payload: Record<string, any>) {
        this.data = {
          ...this.data,
          ...payload,
        }
      },
    }
    componentDefinition.lifetimes.attached.call(instance)
    await nextTick()
    expect(instance.$wevu).toBeDefined()

    componentDefinition.methods.updateMessage.call(instance, 'world')
    await nextTick()
    expect(instance.data.message).toBe('world')

    componentDefinition.lifetimes.detached.call(instance)
    expect(instance.$wevu).toBeUndefined()
  })
})
