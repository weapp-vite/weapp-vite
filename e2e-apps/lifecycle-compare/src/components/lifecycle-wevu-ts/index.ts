import type { LifecycleData, LifecycleEntry, LifecycleInstance } from '../../shared/lifecycle'
import { defineComponent } from 'wevu'
import { COMPONENT_HOOKS, finalizeLifecycleLogs, recordLifecycle } from '../../shared/lifecycle'

const COMPONENT_KIND = 'wevu-ts'
const SOURCE = 'component.wevu.ts'

type LifecycleComponentInstance = LifecycleInstance<LifecycleData> & {
  data: LifecycleData
  triggerEvent: (name: string, detail?: unknown) => void
}

function emitLifecycle(instance: LifecycleComponentInstance, hook: string, args: unknown[]) {
  const entry = recordLifecycle(instance, hook, args, {
    source: SOURCE,
    componentKind: COMPONENT_KIND,
  })
  instance.triggerEvent('lifecycle-log', { componentKind: COMPONENT_KIND, entry })
}

export default defineComponent({
  data: () => ({
    __lifecycleLogs: [] as LifecycleEntry[],
    __lifecycleOrder: 0,
    __lifecycleSeen: {},
    __lifecycleState: {
      tick: 0,
      lastHook: '',
    },
  }),
  setup(_, ctx) {
    const instance = ctx.instance as unknown as LifecycleComponentInstance
    return {
      finalizeLifecycleLogs(hooks: readonly string[] = COMPONENT_HOOKS) {
        const before = instance.data.__lifecycleLogs?.length ?? 0
        finalizeLifecycleLogs(instance, hooks, { source: SOURCE, componentKind: COMPONENT_KIND })
        const logs = instance.data.__lifecycleLogs ?? []
        for (const entry of logs.slice(before)) {
          instance.triggerEvent('lifecycle-log', { componentKind: COMPONENT_KIND, entry })
        }
      },
    }
  },
  lifetimes: {
    created() {
      emitLifecycle(this as LifecycleComponentInstance, 'created', [])
    },
    attached() {
      emitLifecycle(this as LifecycleComponentInstance, 'attached', [])
    },
    ready() {
      emitLifecycle(this as LifecycleComponentInstance, 'ready', [])
    },
    moved() {
      emitLifecycle(this as LifecycleComponentInstance, 'moved', [])
    },
    detached() {
      emitLifecycle(this as LifecycleComponentInstance, 'detached', [])
    },
    error(error) {
      emitLifecycle(this as LifecycleComponentInstance, 'error', [error])
    },
  },
  pageLifetimes: {
    show() {
      emitLifecycle(this as LifecycleComponentInstance, 'pageLifetimes.show', [])
    },
    hide() {
      emitLifecycle(this as LifecycleComponentInstance, 'pageLifetimes.hide', [])
    },
    resize(size) {
      emitLifecycle(this as LifecycleComponentInstance, 'pageLifetimes.resize', [size])
    },
  },
})
