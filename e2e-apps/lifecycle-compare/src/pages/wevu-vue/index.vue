<script lang="ts">
/* eslint-disable vue/no-reserved-keys */
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

const items = Array.from({ length: 120 }, (_, index) => ({
  id: index,
  text: `WeVu Vue item ${index + 1}`,
}))

export default defineComponent({
  setup(_, ctx) {
    const instance = ctx.instance
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
    return {}
  },
  data: () => ({
    items,
    __lifecycleLogs: [],
    __lifecycleOrder: 0,
    __lifecycleSeen: {},
    __lifecycleState: {
      tick: 0,
      lastHook: '',
    },
  }),
  features: {
    enableOnRouteDone: true,
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
  methods: {
    finalizeLifecycleLogs() {
      return finalizeLifecycleLogs(this, PAGE_HOOKS, { source: SOURCE })
    },
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
</style>
