import type { StoreManager } from 'wevu'
import { batch, defineStore, nextTick, watch } from 'wevu'

/** 同时验证小程序中的订阅遍历成本、批次通知与显式同步 watcher。 */
export async function runStoreBatching(owner: StoreManager) {
  let reads = 0
  const rows = Array.from({ length: 1000 }, (_, i) => ({ get value() {
    reads++
    return i
  } }))
  const store = defineStore('issue1049-batching', { state: () => ({ n: 0, rows }) })(owner)
  const sync: string[] = []
  const async: string[] = []
  store.$subscribe((m, s) => sync.push(`${m.type}:${s.n}`), { flush: 'sync' })
  store.$subscribe(() => {}, { flush: 'sync' })
  store.$subscribe((m, s) => async.push(`${m.type}:${s.n}`))
  let watcherRuns = 0
  const stop = watch(() => store.n, () => watcherRuns++, { flush: 'sync' })
  try {
    reads = 0
    store.$patch((state) => {
      for (let n = 1; n <= 20; n++) {
        state.n = n
      }
    })
    await nextTick()
    const patchReads = reads
    reads = 0
    batch(() => {
      store.$patch({ n: 21 })
      store.$patch(state => state.n = 22)
    })
    await nextTick()
    const batchReads = reads
    store.n = 23
    await nextTick()
    return { sync, async, patchReads, batchReads, watcherRuns, value: store.n }
  }
  finally {
    stop()
  }
}
