<script lang="ts">
import { ref } from 'wevu'

import { usePageScrollFeatures } from '../../hooks/pageFeatures'
import * as pageFeatures from '../../hooks/pageFeatures'
import { manualPageFeaturesFromOtherFile } from '../../hooks/pageFeatures/overrides'

const manualPageFeaturesLocal = {
  enableOnShareTimeline: false,
}

export default {
  // 演示：即使使用了 onShareTimeline，也允许用户显式禁用（编译器不会覆盖为 true）。
  // 这里故意组合三种写法：
  // - 从其他文件导出的对象（import）
  // - 当前文件内的对象（local const）
  // - 直接赋值
  // 只要最终配置里为 false，就应当以用户配置为准。
  features: {
    ...manualPageFeaturesFromOtherFile,
    ...manualPageFeaturesLocal,
    enableOnShareTimeline: false,
  },
  setup() {
    const shareTitle = ref('编译时自动 features：跨文件 hook 分析')
    const sharePath = ref('/pages/auto-features/index')
    const shareQuery = ref('from=auto-features')

    const scrollTop = ref(0)
    const lastScrollAt = ref('-')
    const reachBottomCount = ref(0)
    const pullDownCount = ref(0)

    const buildInspectPath = ref('dist/pages/auto-features/index.js')

    const list = Array.from({ length: 80 }, (_, idx) => `占位内容 #${idx + 1}`)

    pageFeatures.usePageShare({
      title: shareTitle,
      path: sharePath,
      query: shareQuery,
    })

    usePageScrollFeatures({
      scrollTop,
      lastScrollAt,
      reachBottomCount,
      pullDownCount,
    })

    function onShareTitleInput(event: any) {
      shareTitle.value = event?.detail?.value ?? ''
    }

    function scrollToTop() {
      wx.pageScrollTo({ scrollTop: 0, duration: 200 })
    }

    function scrollToBottom() {
      wx.pageScrollTo({ scrollTop: 99999, duration: 200 })
    }

    function copyInspectPath() {
      wx.setClipboardData({ data: buildInspectPath.value })
    }

    return {
      shareTitle,
      sharePath,
      scrollTop,
      lastScrollAt,
      reachBottomCount,
      pullDownCount,
      buildInspectPath,
      list,
      onShareTitleInput,
      scrollToTop,
      scrollToBottom,
      copyInspectPath,
    }
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      编译时自动 features
    </view>

    <view class="section">
      <view class="section-title">
        目标：不写 features / 不写原生 onXXX
      </view>
      <view class="note">
        这个页面只在多个 TS hook 里调用 wevu 的 onShareAppMessage/onPageScroll/...；weapp-vite 会在编译阶段自动补齐
        <text class="code">
          features.enableOnXxx = true
        </text>
        ，保证这些 Page 事件能被注入并派发。
      </view>
      <view class="note">
        你可以构建后打开
        <text class="code">
          {{ buildInspectPath }}
        </text>
        搜索
        <text class="code">
          features
        </text>
        验证注入结果。
      </view>
      <button class="btn btn-primary" @click="copyInspectPath">
        复制编译产物路径
      </button>
    </view>

    <view class="section">
      <view class="section-title">
        分享 hook（来自 TS 抽离）
      </view>
      <view class="field">
        <text class="label">
          分享标题
        </text>
        <input class="input" :value="shareTitle" placeholder="输入分享标题" @input="onShareTitleInput">
      </view>
      <view class="note">
        右上角菜单应出现「转发」「分享到朋友圈」（由 hook + 编译期 features 注入共同保证）。
      </view>
      <view class="note">
        本页额外演示手动覆盖（复杂组合）：通过「其他文件导出」「当前文件常量」「直接赋值」三种方式设置
        <text class="code">
          enableOnShareTimeline: false
        </text>
        ，即使调用了对应 hook，编译器也不会强行改成 true（最终行为以用户配置为准）。
      </view>
      <view class="note">
        path：
        <text class="code">
          {{ sharePath }}
        </text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        滚动/触底/下拉刷新（来自 TS 抽离）
      </view>
      <view class="metrics">
        <view class="metric">
          <text class="metric-label">
            scrollTop
          </text>
          <text class="metric-value">
            {{ scrollTop }}
          </text>
        </view>
        <view class="metric">
          <text class="metric-label">
            lastScrollAt
          </text>
          <text class="metric-value">
            {{ lastScrollAt }}
          </text>
        </view>
        <view class="metric">
          <text class="metric-label">
            onReachBottom
          </text>
          <text class="metric-value">
            {{ reachBottomCount }}
          </text>
        </view>
        <view class="metric">
          <text class="metric-label">
            onPullDownRefresh
          </text>
          <text class="metric-value">
            {{ pullDownCount }}
          </text>
        </view>
      </view>

      <view class="actions">
        <button class="btn btn-info" @click="scrollToTop">
          滚动到顶部
        </button>
        <button class="btn btn-warning" @click="scrollToBottom">
          滚动到底部（触发触底）
        </button>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        占位内容（用于产生页面滚动）
      </view>
      <view class="list">
        <view v-for="item in list" :key="item" class="list-item">
          {{ item }}
        </view>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.note {
  font-size: 26rpx;
  color: #556;
  line-height: 1.6;
  margin-bottom: 16rpx;
}

.code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  background: #f3f6ff;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  color: #3b5bdb;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.label {
  font-size: 26rpx;
  color: #333;
}

.input {
  background: #fff;
  border: 2rpx solid #e7eaf3;
  border-radius: 12rpx;
  padding: 18rpx 20rpx;
  font-size: 28rpx;
}

.metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.metric {
  background: #f8faff;
  border-radius: 12rpx;
  padding: 16rpx;
}

.metric-label {
  display: block;
  color: #667;
  font-size: 24rpx;
  margin-bottom: 8rpx;
}

.metric-value {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: #1a1a1a;
}

.actions {
  display: flex;
  gap: 16rpx;
}

.list-item {
  padding: 22rpx 0;
  border-bottom: 2rpx solid #f1f3f5;
  color: #2c3e50;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "navigationBarTitleText": "自动 features",
  "enablePullDownRefresh": true,
  "backgroundTextStyle": "dark"
}
</config>
