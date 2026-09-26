import { computed, defineStore, nextTick, onScopeDispose, ref } from 'wevu'

export const metrics = {
  page: 0,
  detached: 0,
  child: 0,
  actions: 0,
  detachedActions: 0,
  after: 0,
  errors: 0,
  cleanup: 0,
  hidden: 0,
  unloaded: 0,
}
let finish: (() => void) | undefined
let fail: (() => void) | undefined
export const useIssue1049Store = defineStore('issue-1049', () => {
  const count = ref(0)
  onScopeDispose(() => metrics.cleanup++)
  return {
    count,
    doubled: computed(() => count.value * 2),
    increment: () => ++count.value,
    wait: () => new Promise<void>((resolve) => {
      finish = resolve
    }),
    reject: () => new Promise<void>((_resolve, reject) => {
      fail = () => reject(new Error('expected'))
    }),
  }
})

export function resetScenario() {
  useIssue1049Store().$dispose()
  useIssue1049Store().count = 0
  for (const key of Object.keys(metrics) as (keyof typeof metrics)[]) {
    metrics[key] = 0
  }
}

export async function settleActions() {
  finish?.()
  fail?.()
  await nextTick()
  await nextTick()
}

export function snapshot() {
  const store = useIssue1049Store()
  return { ...metrics, count: store.count, doubled: store.doubled }
}
