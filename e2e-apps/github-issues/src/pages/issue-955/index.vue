<script setup lang="ts">
import { nextTick, shallowRef, useTemplateRef } from 'wevu'
import NativePropsProbe from '../../components/issue-955/NativePropsProbe/index.vue'

type Transition = 'null' | 'number' | 'string' | 'undefined'

interface NativePropsProbeSnapshot {
  content: string
  src: string
  nullable: string
  initialSummary: string
}

interface NativePropsProbeExposed {
  snapshot: () => NativePropsProbeSnapshot
}

const content = shallowRef<number | string>('SALE')
const src = shallowRef<string>()
const nullable = shallowRef<string | null>(null)
const probe = useTemplateRef<NativePropsProbeExposed>('probe')

definePageJson({
  navigationBarTitleText: 'issue-955',
})

function describeValue(value: unknown) {
  if (value === undefined) {
    return 'undefined'
  }
  if (value === null) {
    return 'null'
  }
  return `${typeof value}:${String(value)}`
}

function applyTransition(transition: Transition) {
  if (transition === 'number') {
    content.value = 42
    src.value = 'number.png'
    nullable.value = 'number-label'
  }
  else if (transition === 'string') {
    content.value = 'PROMO'
    src.value = 'string.png'
    nullable.value = 'string-label'
  }
  else if (transition === 'null') {
    // 回归探针刻意越过静态类型，模拟模板桥把空值交给宿主 properties 的过程。
    content.value = null as unknown as number | string
    src.value = null as unknown as string
    nullable.value = null
  }
  else {
    content.value = undefined as unknown as number | string
    src.value = undefined
    nullable.value = null
  }
}

async function _runE2E(transition?: Transition) {
  if (transition) {
    applyTransition(transition)
    await nextTick()
  }
  return {
    ready: typeof probe.value?.snapshot === 'function',
    parent: {
      content: describeValue(content.value),
      src: describeValue(src.value),
    },
    child: probe.value?.snapshot() ?? null,
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view id="issue955-page" class="issue955-page">
    <text class="issue955-page__title">
      issue-955 native nullable and union props
    </text>
    <NativePropsProbe
      ref="probe"
      :content="content"
      :src="src"
      :nullable="nullable"
    />
  </view>
</template>

<style scoped>
.issue955-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.issue955-page__title {
  display: block;
  margin-bottom: 16rpx;
  font-weight: 700;
  color: #0f172a;
}
</style>
