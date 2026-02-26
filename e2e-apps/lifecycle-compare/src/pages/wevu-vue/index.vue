<script lang="ts">
/* eslint-disable vue/no-reserved-keys */
import type { LifecycleData, LifecycleEntry, LifecycleInstance } from '../../shared/lifecycle'
import {
  defineComponent,
  onAddToFavorites,
  onHide,
  onLoad,
  onPageScroll,
  onPullDownRefresh,
  onReachBottom,
  onReady,
  onResize,
  onRouteDone,
  onSaveExitState,
  onShareAppMessage,
  onShareTimeline,
  onShow,
  onTabItemTap,
  onUnload,
} from 'wevu'
import { finalizeLifecycleLogs, PAGE_HOOKS, recordLifecycle } from '../../shared/lifecycle'

const SOURCE = 'page.wevu.vue'

type LifecyclePageData = LifecycleData & { items: { id: number, text: string }[] }

type LifecyclePageInstance = LifecycleInstance<LifecyclePageData> & { data: LifecyclePageData }

const items = Array.from({ length: 120 }, (_, index) => ({
  id: index,
  text: `WeVu Vue item ${index + 1}`,
}))

export default defineComponent({
  setup(_, ctx) {
    const instance = ctx.instance as unknown as LifecyclePageInstance
    const finalize = () => finalizeLifecycleLogs(instance, PAGE_HOOKS, { source: SOURCE })
    onLoad((query) => {
      recordLifecycle(instance, 'onLoad', [query], { source: SOURCE })
    })
    onShow(() => {
      recordLifecycle(instance, 'onShow', [], { source: SOURCE })
    })
    onReady(() => {
      recordLifecycle(instance, 'onReady', [], { source: SOURCE })
    })
    onHide(() => {
      recordLifecycle(instance, 'onHide', [], { source: SOURCE })
    })
    onUnload(() => {
      recordLifecycle(instance, 'onUnload', [], { source: SOURCE })
    })
    onRouteDone(() => {
      recordLifecycle(instance, 'onRouteDone', [], { source: SOURCE })
    })
    onPullDownRefresh(() => {
      recordLifecycle(instance, 'onPullDownRefresh', [], { source: SOURCE })
      wx.stopPullDownRefresh()
    })
    onReachBottom(() => {
      recordLifecycle(instance, 'onReachBottom', [], { source: SOURCE })
    })
    onPageScroll((options) => {
      recordLifecycle(instance, 'onPageScroll', [options], { source: SOURCE })
    })
    onResize((options) => {
      recordLifecycle(instance, 'onResize', [options], { source: SOURCE })
    })
    onTabItemTap((options) => {
      recordLifecycle(instance, 'onTabItemTap', [options], { source: SOURCE })
    })
    onShareAppMessage((options) => {
      recordLifecycle(instance, 'onShareAppMessage', [options], { source: SOURCE })
      return {
        title: 'Lifecycle WeVu Vue Share',
        path: '/pages/wevu-vue/index',
      }
    })
    onShareTimeline(() => {
      recordLifecycle(instance, 'onShareTimeline', [], { source: SOURCE })
      return {
        title: 'Lifecycle WeVu Vue Timeline',
      }
    })
    onAddToFavorites((options) => {
      recordLifecycle(instance, 'onAddToFavorites', [options], { source: SOURCE })
      return {
        title: 'Lifecycle WeVu Vue Favorite',
      }
    })
    onSaveExitState(() => {
      recordLifecycle(instance, 'onSaveExitState', [], { source: SOURCE })
      return {
        data: {
          reason: 'wevu-vue',
        },
      }
    })
    return {
      finalizeLifecycleLogs: finalize,
    }
  },
  data: () => ({
    items,
    __lifecycleLogs: [] as LifecycleEntry[],
    __lifecycleOrder: 0,
    __lifecycleSeen: {},
    __lifecycleState: {
      tick: 0,
      lastHook: '',
    },
    __lifecycleExpected: PAGE_HOOKS,
    __lifecycleSummary: {
      total: PAGE_HOOKS.length,
      seen: 0,
      skipped: PAGE_HOOKS.length,
      entries: 0,
      lastHook: '',
    },
    __lifecyclePreview: [] as LifecycleEntry[],
  }),
  features: {
    enableOnRouteDone: true,
    enableOnRouteDoneFallback: true,
    enableOnPullDownRefresh: true,
    enableOnReachBottom: true,
    enableOnPageScroll: true,
    enableOnResize: true,
    enableOnTabItemTap: true,
    enableOnShareAppMessage: true,
    enableOnShareTimeline: true,
    enableOnAddToFavorites: true,
    enableOnSaveExitState: true,
  },
})
</script>

<template>
  <view class="page">
    <view class="title">
      WeVu Vue Page
    </view>
    <view class="state">
      Last: {{ __lifecycleState.lastHook }} ({{ __lifecycleState.tick }})
    </view>
    <view class="panel">
      <view class="panel-title">
        E2E Result
      </view>
      <view class="panel-row">
        Hooks: {{ __lifecycleSummary.seen }}/{{ __lifecycleSummary.total }}
      </view>
      <view class="panel-row">
        Skipped: {{ __lifecycleSummary.skipped }}
      </view>
      <view class="panel-row">
        Logs: {{ __lifecycleSummary.entries }}
      </view>
      <view class="panel-row">
        Last: {{ __lifecycleSummary.lastHook }}
      </view>
    </view>
    <view class="panel">
      <view class="panel-title">
        E2E Logs (latest)
      </view>
      <view v-for="item in __lifecyclePreview" :key="item.order" class="panel-row">
        {{ item.order }}. {{ item.hook }}{{ item.skipped ? ' (skipped)' : '' }}
      </view>
    </view>
    <view class="list">
      <view v-for="item in items" :key="item.id" class="item">
        {{ item.text }}
      </view>
    </view>
  </view>
</template>

<style>
.page {
  padding: 16rpx;
}

.title {
  font-size: 32rpx;
  font-weight: 600;
}

.state {
  margin: 12rpx 0 20rpx;
  color: #666;
}

.item {
  padding: 12rpx 0;
  border-bottom: 1rpx solid #eee;
}

.panel {
  padding: 12rpx;
  margin: 12rpx 0 16rpx;
  background: #f8fafc;
  border: 1rpx solid #e5e7eb;
  border-radius: 12rpx;
}

.panel-title {
  margin-bottom: 8rpx;
  font-weight: 600;
}

.panel-row {
  font-size: 22rpx;
  color: #374151;
}
</style>

<json>
{
  "component": false,
  "enablePullDownRefresh": true,
  "onReachBottomDistance": 50
}
</json>
