import { defineComponent } from 'wevu'
import { COMPONENT_HOOKS, finalizeLifecycleLogs, recordLifecycle } from '../../shared/lifecycle'

const COMPONENT_KIND = 'wevu-ts'
const SOURCE = 'component.wevu.ts'

function emitLifecycle(
  instance: WechatMiniprogram.Component.Instance<Record<string, any>>,
  hook: string,
  args: unknown[],
) {
  const entry = recordLifecycle(instance, hook, args, {
    source: SOURCE,
    componentKind: COMPONENT_KIND,
  })
  instance.triggerEvent('lifecycle-log', { componentKind: COMPONENT_KIND, entry })
}

export default defineComponent({
  data: () => ({
    __lifecycleLogs: [],
    __lifecycleOrder: 0,
    __lifecycleSeen: {},
    __lifecycleState: {
      tick: 0,
      lastHook: '',
    },
  }),
  lifetimes: {
    created() {
      emitLifecycle(this, 'created', [])
    },
    attached() {
      emitLifecycle(this, 'attached', [])
    },
    ready() {
      emitLifecycle(this, 'ready', [])
    },
    moved() {
      emitLifecycle(this, 'moved', [])
    },
    detached() {
      emitLifecycle(this, 'detached', [])
    },
    error(error) {
      emitLifecycle(this, 'error', [error])
    },
  },
  pageLifetimes: {
    show() {
      emitLifecycle(this, 'pageLifetimes.show', [])
    },
    hide() {
      emitLifecycle(this, 'pageLifetimes.hide', [])
    },
    resize(size) {
      emitLifecycle(this, 'pageLifetimes.resize', [size])
    },
  },
  methods: {
    finalizeLifecycleLogs(hooks: readonly string[] = COMPONENT_HOOKS) {
      const before = this.data.__lifecycleLogs?.length ?? 0
      finalizeLifecycleLogs(this, hooks, { source: SOURCE, componentKind: COMPONENT_KIND })
      const logs = this.data.__lifecycleLogs ?? []
      for (const entry of logs.slice(before)) {
        this.triggerEvent('lifecycle-log', { componentKind: COMPONENT_KIND, entry })
      }
    },
  },
})
