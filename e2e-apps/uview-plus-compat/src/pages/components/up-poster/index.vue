<script setup lang="ts">
import { nextTick, ref } from 'wevu'
import sampleImage from '../../../assets/sample.png'

definePageJson({ navigationBarTitleText: 'up-poster' })

const interactionCount = ref(0)
const scenarioState = ref('pending')
const e2eComponent = ref<Record<string, unknown> | null>(null)

async function runE2E() {
  await nextTick()
  for (let attempt = 0; attempt < 20 && !e2eComponent.value; attempt += 1) {
    await new Promise<void>(resolve => setTimeout(resolve, 25))
  }
  const pages = getCurrentPages()
  interface SelectorOwner {
    [key: string]: unknown
    selectComponent?: (selector: string) => Record<string, unknown> | null
  }
  const page = pages[pages.length - 1] as SelectorOwner | undefined
  const parent = page?.selectComponent?.('#e2e-parent') as SelectorOwner | null | undefined
  const slotOwner = parent?.selectComponent?.('scoped-slots-default') as SelectorOwner | null | undefined
  const parentProxy = (parent as any)?.__wevu?.proxy
  const registeredChild = Array.isArray(parentProxy?.children)
    ? parentProxy.children.find((child: any) => ['up-poster', 'u-poster'].includes(child?.$options?.name))
    : null
  const target = e2eComponent.value
    ?? page?.selectComponent?.('#e2e-component')
    ?? parent?.selectComponent?.('#e2e-component')
    ?? slotOwner?.selectComponent?.('#e2e-component')
    ?? page?.selectComponent?.('up-poster')
    ?? page?.selectComponent?.('up-poster')
    ?? registeredChild
    ?? null
  const rendered = target !== null
  scenarioState.value = rendered ? 'pass:render' : 'fail:render'
  await nextTick()
  return {
    ok: rendered,
    component: 'up-poster',
    rendered,
    capability: 'render' as const,
    state: scenarioState.value,
    interactionCount: interactionCount.value,
  }
}
</script>

<template>
  <view id="e2e-root" class="scenario-page" data-component="up-poster">
    <view class="scenario-header">
      <view class="scenario-title">up-poster</view>
      <view class="scenario-status">rendered / interactive</view>
    </view>
    <view id="e2e-target" class="scenario-subject">
      <up-poster id="e2e-component" ref="e2eComponent" title="Stable poster" :image="sampleImage" />
    </view>
    <button id="e2e-action" class="scenario-action" @click="runE2E">
      Exercise interaction
    </button>
    <view id="e2e-state" class="scenario-state">{{ scenarioState }} / interaction={{ interactionCount }}</view>
  </view>
</template>

<style>
.scenario-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f5f6f8;
}

.scenario-header {
  padding-bottom: 20rpx;
  border-bottom: 2rpx solid #d9dde3;
}

.scenario-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #1f2329;
}

.scenario-status,
.scenario-state {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #5f6670;
}

.scenario-subject {
  min-height: 180rpx;
  padding: 28rpx 12rpx;
  margin-top: 24rpx;
  overflow: visible;
  background: #fff;
  border: 2rpx solid #e1e4e8;
  border-radius: 8rpx;
}

.scenario-action {
  margin-top: 24rpx;
  color: #fff;
  background: #1769e0;
  border-radius: 8rpx;
}

.badge-anchor,
.curtain-content,
.grid-block,
.transition-content,
.watermark-content {
  padding: 20rpx;
  background: #eef3fa;
}
</style>
