<script lang="ts">
/* eslint-disable vue/no-reserved-keys */
import type { LifecycleData, LifecycleEntry, LifecycleInstance } from '../../shared/lifecycle'
import { defineComponent } from 'wevu'
import { COMPONENT_HOOKS, finalizeLifecycleLogs, recordLifecycle } from '../../shared/lifecycle'

const COMPONENT_KIND = 'wevu-vue'
const SOURCE = 'component.wevu.vue'

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
  methods: {
    finalizeLifecycleLogs(hooks: readonly string[] = COMPONENT_HOOKS) {
      const instance = this as unknown as LifecycleComponentInstance
      const before = instance.data.__lifecycleLogs?.length ?? 0
      finalizeLifecycleLogs(instance, hooks, { source: SOURCE, componentKind: COMPONENT_KIND })
      const logs = instance.data.__lifecycleLogs ?? []
      for (const entry of logs.slice(before)) {
        instance.triggerEvent('lifecycle-log', { componentKind: COMPONENT_KIND, entry })
      }
    },
  },
})
</script>

<template>
  <view class="component">
    <text>WeVu Vue Component</text>
    <text class="state">
      {{ __lifecycleState.lastHook }}
    </text>
  </view>
</template>

<style>
.component {
  padding: 12rpx;
  border: 1rpx solid #eee;
  border-radius: 8rpx;
}

.state {
  margin-left: 8rpx;
  color: #999;
}
</style>
