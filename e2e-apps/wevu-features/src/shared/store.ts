import { computed, createStore, defineStore, reactive, ref } from 'wevu'

const pluginRecords: string[] = []
let storeManagerReady = false

export function initFeatureStoreManager() {
  if (storeManagerReady) {
    return
  }

  const manager = createStore()
  manager.use(({ store }) => {
    const storeId = String((store as any).$id ?? 'unknown')
    pluginRecords.push(storeId)
    ;(store as any).__featurePluginTouched = true
  })

  storeManagerReady = true
}

export function getFeaturePluginRecords() {
  return pluginRecords.slice()
}

initFeatureStoreManager()

export const useSetupFeatureStore = defineStore('featureSetupCounter', () => {
  const count = ref(0)
  const label = ref('init')
  const meta = reactive({
    visits: 0,
  })
  const doubled = computed(() => count.value * 2)

  function inc(step = 1) {
    count.value += step
    return count.value
  }

  function visit() {
    meta.visits += 1
    return meta.visits
  }

  function rename(next: string) {
    label.value = next
  }

  return {
    count,
    label,
    meta,
    doubled,
    inc,
    visit,
    rename,
  }
})

interface FeatureOptionsState {
  count: number
  label: string
  items: number[]
}

export const useOptionsFeatureStore = defineStore('featureOptionsCounter', {
  state: (): FeatureOptionsState => ({
    count: 0,
    label: 'zero',
    items: [],
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
    rename(next: string) {
      this.label = next
    },
  },
})
