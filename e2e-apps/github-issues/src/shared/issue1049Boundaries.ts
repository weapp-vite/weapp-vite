import { createStore, defineStore, disposePinia, getActivePinia, isReactive, nextTick, setActivePinia, shallowReactive, shallowRef, storeToRefs } from 'wevu'

/** 在独立管理器中收集真实 runtime 的 Store 边界，结束后恢复应用管理器。 */
export async function runStoreBoundaries() {
  const previous = getActivePinia()
  const owner = createStore()
  const pluginSync: string[] = []
  const pluginAsync: string[] = []
  owner.use(({ store }) => {
    if (store.$id !== 'issue1049-plugin') {
      return
    }
    store.$subscribe((mutation: { type: string }, state: { n: number }) => pluginSync.push(`${mutation.type}:${state.n}`), { flush: 'sync' })
    store.$subscribe((mutation: { type: string }, state: { n: number }) => pluginAsync.push(`${mutation.type}:${state.n}`))
    store.n = 1
  })
  // 仅激活此场景的插件队列，不注册宿主 App 或覆盖应用的 provide。
  owner.install({ provide() {}, config: { globalProperties: {} } })
  try {
    const plugin = defineStore('issue1049-plugin', { state: () => ({ n: 0 }) })(owner)
    const pluginDuring = pluginSync.slice()
    await nextTick()
    plugin.n = 3
    await nextTick()

    const patchStore = defineStore('issue1049-patch', { state: () => ({ n: 0 }) })(owner)
    const patch: string[] = []
    patchStore.$subscribe((mutation, state) => patch.push(`${mutation.type}:${state.n}`))
    patchStore.$patch((state) => {
      state.n = 1
      patchStore.$patch({ n: 2 })
      state.n = 3
    })
    await nextTick()
    patchStore.n = 4
    await nextTick()

    const source = shallowRef({ n: 0 })
    const data = shallowReactive({ nested: { n: 0 } })
    const shallow = defineStore('issue1049-shallow', () => ({ source, data }))(owner)
    const refs = storeToRefs(shallow)
    const shallowEvents: string[] = []
    shallow.$subscribe(mutation => shallowEvents.push(mutation.type), { flush: 'sync' })
    const identity = shallow.source === source.value && shallow.data === data
    const rawNested = !isReactive(shallow.source) && !isReactive(shallow.data.nested)
    shallow.source.n++
    shallow.data.nested.n++
    const shallowDuring = shallowEvents.slice()
    refs.source.value = { n: 5 }
    shallow.data.nested = { n: 6 }
    return {
      patch,
      pluginDuring,
      pluginSync,
      pluginAsync,
      identity,
      rawNested,
      shallowDuring,
      shallowEvents,
      values: [shallow.source.n, shallow.data.nested.n],
      summary: `patch:${patch.length} shallow:${shallowEvents.length} plugin:${pluginSync.length}`,
    }
  }
  finally {
    disposePinia(owner)
    setActivePinia(previous)
  }
}
