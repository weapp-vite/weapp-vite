import { computed, createStore, defineStore, reactive, ref } from 'wevu'

const pluginRecords: string[] = []
let manager: ReturnType<typeof createStore> | undefined
let hotVersion = 1

export function initStoreManager() {
  if (manager) {
    return manager
  }
  manager = createStore()
  manager.use(({ store }) => {
    const id = (store as any).$id ?? 'unknown'
    pluginRecords.push(id)
    ;(store as any).__pluginTouched = true
  })
  return manager
}

initStoreManager()

export function getPluginRecords() {
  return pluginRecords.slice()
}

export function getHotVersion() {
  return hotVersion
}

export function hotUpdateSetupStore(store: ReturnType<typeof useSetupStore>) {
  hotVersion += 1
  const step = hotVersion
  store.inc = (delta = 1) => {
    store.count.value += delta * step
    return store.count.value
  }
  return step
}

export const useSetupStore = defineStore('setupCounter', () => {
  const count = ref(0)
  const name = ref('init')
  const meta = reactive({ visits: 0 })
  const doubled = computed(() => count.value * 2)

  const inc = (step = 1) => {
    count.value += step
    return count.value
  }

  const visit = () => {
    meta.visits += 1
    return meta.visits
  }

  const setName = (next: string) => {
    name.value = next
  }

  return {
    count,
    name,
    meta,
    doubled,
    inc,
    visit,
    setName,
  }
})

export const useOptionsStore = defineStore('optionsCounter', {
  state: () => ({
    count: 0,
    label: 'zero',
    items: [] as number[],
  }),
  getters: {
    doubled: state => state.count * 2,
  },
  actions: {
    inc(step = 1) {
      this.count += step
      this.items.push(this.count)
      return this.count
    },
    rename(label: string) {
      this.label = label
    },
  },
})
