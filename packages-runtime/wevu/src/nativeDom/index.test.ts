import { h, renderSlot } from '@vue/runtime-core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, watch } from '../reactivity'
import { createWevuComponent } from '../runtime/define'
import { onBeforeUpdate, onLoad, onMounted, onUnmounted, onUpdated } from '../runtime/hooks'
import { registerInitialNavigationLifecycle } from '../runtime/navigationLifecycle'
import { inject, provide } from '../runtime/provide'
import { nextTick } from '../scheduler'
import { FakeNode } from './fake.testHelper'
import { withNativeDom } from './registration'

function runtime() {
  const container = new FakeNode('#document')
  const native = vi.fn((type: string) => new FakeNode(type))
  vi.stubGlobal('tt', {
    getRenderMode: () => 2,
    appDocument: {
      createElement: (type: string) => new FakeNode(type),
      createNativeComponent: native,
      createTextNode: (text: string) => Object.assign(new FakeNode('#text'), { nodeValue: text }),
      getPageDocumentById: (id: number) => id === 42 ? container : undefined,
    },
  })
  return { container, native }
}

function register(options: Record<string, any>, render: (...args: any[]) => any, mode: 'auto' | 'native-dom' = 'native-dom') {
  const Component = vi.fn()
  vi.stubGlobal('Component', Component)
  createWevuComponent(withNativeDom({ __wevu_isPage: true, ...options }, render, { mode, platform: 'tt', isPage: true }) as any)
  const definition = Component.mock.lastCall![0] as Record<string, any>
  const host = { __webviewId__: 42, properties: {}, data: { ...definition.data }, setData: vi.fn() }
  for (const name of ['created', 'attached']) {
    definition.lifetimes[name]?.call(host)
  }
  return { definition, host, load: () => definition.onLoad.call(host, { test: 'query' }), unload: () => definition.onUnload.call(host) }
}

const text = (node: FakeNode): string => node.nodeValue ?? node.children.map(text).join('')
afterEach(() => {
  vi.unstubAllGlobals()
  registerInitialNavigationLifecycle({ ensure: () => undefined, cancel: () => {} })
})

describe('Wevu TT native DOM', () => {
  it('在 setup 前选定后端，响应 Wevu refs/computed，按提交派发生命周期且不调用 setData', async () => {
    const { container } = runtime()
    const count = ref(0)
    const events: string[] = []
    const setup = vi.fn(() => {
      onLoad((query) => {
        events.push(`load:${query.test}`)
      })
      onMounted(() => events.push(`mounted:${text(container)}`))
      onBeforeUpdate(() => events.push('beforeUpdate'))
      onUpdated(() => events.push(`updated:${text(container)}`))
      onUnmounted(() => events.push('unmounted'))
      watch(count, () => events.push('watch'))
      return { count, double: computed(() => count.value * 2) }
    })
    const page = register({ setup }, ctx => h('view', { id: 'counter' }, String(ctx.double)))
    expect(setup).not.toHaveBeenCalled()
    page.load()
    expect(events).toEqual(['load:query', 'mounted:0'])
    count.value = 1
    count.value = 2
    await nextTick()
    expect(text(container)).toBe('4')
    expect(events).toEqual(['load:query', 'mounted:0', 'watch', 'beforeUpdate', 'updated:4'])
    expect(page.host.setData).not.toHaveBeenCalled()
    page.unload()
    expect(container.children).toEqual([])
    expect(events.at(-1)).toBe('unmounted')
    count.value++
    await nextTick()
    expect(events.at(-1)).toBe('unmounted')
  })

  it('保留 keyed 节点身份，增删排序、清空属性/style，并释放捕获与冒泡监听', async () => {
    const { container } = runtime()
    const list = ref([1, 2, 3])
    const styled = ref(true)
    const capture = vi.fn()
    const tap = vi.fn()
    const page = register({ setup: () => ({ list, styled }) }, ctx => h('view', {}, ctx.list.map((id: number) => h('button', {
      key: id,
      id: ctx.styled ? `item-${id}` : null,
      style: ctx.styled ? { color: 'red', fontSize: '12px' } : null,
      onTapCapture: ctx.styled ? capture : undefined,
      onTap: ctx.styled ? tap : undefined,
    }, String(id)))))
    page.load()
    const parent = container.children[0]!
    const two = parent.children[1]!
    two.dispatch('bindtap')
    expect(capture).toHaveBeenCalledOnce()
    expect(tap).toHaveBeenCalledOnce()
    list.value = [3, 2, 4]
    styled.value = false
    await nextTick()
    expect(text(parent)).toBe('324')
    expect(parent.children[1]).toBe(two)
    expect(two.attributes.has('style')).toBe(false)
    expect(two.attributes.has('id')).toBe(false)
    expect(two.listeners.size).toBe(0)
    page.unload()
  })

  it('虚拟 SFC 子组件接收响应式 props、slots 和 emit，原生标签使用 bridge', async () => {
    const { container, native } = runtime()
    const value = ref('first')
    const emit = vi.fn()
    const Child = withNativeDom({
      props: { label: String },
      setup: (props: any, ctx: any) => ({ label: computed(() => props.label), fire: () => ctx.emit('pick', props.label) }),
    }, ctx => h('view', { onTap: ctx.fire }, [h('text', {}, ctx.label), renderSlot(ctx.$slots, 'default')]), { mode: 'native-dom', platform: 'tt', isPage: false })
    const page = register({ setup: () => ({ value }) }, ctx => h(Child, { label: ctx.value, onPick: emit }, { default: () => h('native-card', { value: ctx.value }) }))
    page.load()
    expect(text(container)).toBe('first')
    expect(native).toHaveBeenCalledWith('native-card', { __tt__inner__options__: { name: 'native-card' } })
    value.value = 'second'
    await nextTick()
    expect(text(container)).toBe('second')
    container.children[0]!.dispatch('bindtap')
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'pick', detail: 'second' }))
    page.unload()
  })

  it('auto 缺失能力时只执行一次 legacy setup，显式 native-dom 缺失能力报错', () => {
    vi.stubGlobal('tt', {})
    const setup = vi.fn(() => ({ value: ref(1) }))
    const page = register({ setup }, () => h('view'), 'auto')
    page.load()
    expect(setup).toHaveBeenCalledOnce()
    expect(page.host.setData).toHaveBeenCalledWith({ __wevuLegacyRenderer: true })
    page.unload()
    const explicit = register({ setup }, () => h('view'))
    expect(explicit.load).toThrow('Render Mode V2')
    expect(setup).toHaveBeenCalledOnce()
  })

  it('auto 在已选定后端后的宿主操作失败时抛错且不重跑 legacy', () => {
    runtime()
    ;(globalThis as any).tt.appDocument.createElement = () => {
      throw new Error('native insert failed')
    }
    const setup = vi.fn(() => ({}))
    const page = register({ setup }, () => h('view'), 'auto')
    expect(page.load).toThrow('native insert failed')
    expect(setup).toHaveBeenCalledOnce()
    expect(page.host.setData).not.toHaveBeenCalled()
  })

  it('隔离父子 hooks 和 provide，重复卸载不重复派发', () => {
    const { container } = runtime()
    const events: string[] = []
    const Child = withNativeDom({
      setup() {
        const inherited = inject('label')
        provide('label', 'child')
        onMounted(() => events.push(`child:${inherited}`))
        onUnmounted(() => events.push('child:unmount'))
        return {}
      },
    }, () => h('text', {}, 'child'), { mode: 'auto', platform: 'tt', isPage: false })
    const page = register({
      setup() {
        provide('label', 'parent')
        onMounted(() => events.push(`parent:${inject('label', 'outside-setup')}`))
        onUnmounted(() => events.push('parent:unmount'))
        return {}
      },
    }, () => h('view', {}, [h(Child), h(Child)]))
    page.load()
    expect(events).toEqual(['child:parent', 'child:parent', 'parent:outside-setup'])
    page.unload()
    page.unload()
    page.definition.lifetimes.detached.call(page.host)
    expect(events.slice(3)).toEqual(['child:unmount', 'child:unmount', 'parent:unmount'])
    expect(container.children).toEqual([])
  })

  it.each([true, false, 'unload'] as const)('首航守卫完成前不执行 setup，完成状态为 %s', async (result) => {
    const { container } = runtime()
    let finish!: (value: boolean) => void
    const cancelled = vi.fn()
    registerInitialNavigationLifecycle({
      ensure: (_host, _query, options) => new Promise<boolean>((resolve) => {
        finish = (value) => {
          options?.onComplete?.(value)
          resolve(value)
        }
      }),
      cancel: cancelled,
    })
    const show = vi.fn()
    const setup = vi.fn(() => ({}))
    const page = register({ setup, onShow: show }, () => h('text', {}, 'mounted'))
    const pending = page.load()
    page.definition.onShow.call(page.host)
    expect(setup).not.toHaveBeenCalled()
    expect(show).not.toHaveBeenCalled()
    if (result === 'unload') {
      page.unload()
    }
    finish(result !== false)
    await pending
    expect(setup).toHaveBeenCalledTimes(result === true ? 1 : 0)
    expect(show).toHaveBeenCalledTimes(result === true ? 1 : 0)
    expect(text(container)).toBe(result === true ? 'mounted' : '')
    page.unload()
    expect(cancelled).toHaveBeenCalledTimes(result === false ? 0 : 1)
  })
})
