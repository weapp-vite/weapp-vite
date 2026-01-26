<script lang="ts">
/* eslint-disable vue/no-reserved-keys */
import type { LifecycleData } from '../../shared/lifecycle'
import { defineComponent } from 'wevu'
import { COMPONENT_HOOKS, finalizeLifecycleLogs, recordLifecycle } from '../../shared/lifecycle'

const COMPONENT_KIND = 'wevu-vue'
const SOURCE = 'component.wevu.vue'

type LifecycleComponentInstance = WechatMiniprogram.Component.Instance<LifecycleData>

function emitLifecycle(instance: LifecycleComponentInstance, hook: string, args: unknown[]) {
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
