<script setup lang="ts">
import { computed, ref } from 'wevu'

import { useLayoutFeedback } from '@/hooks/useLayoutFeedback'

definePageJson({
  navigationBarTitleText: 'Wevu 多端数据',
  usingComponents: {
    't-button': 'tdesign-miniprogram/button/button',
    't-cell': 'tdesign-miniprogram/cell/cell',
    't-cell-group': 'tdesign-miniprogram/cell-group/cell-group',
    't-progress': 'tdesign-miniprogram/progress/progress',
    't-tabs': 'tdesign-miniprogram/tabs/tabs',
    't-tab-panel': 'tdesign-miniprogram/tab-panel/tab-panel',
    't-tag': 'tdesign-miniprogram/tag/tag',
  },
})

const activeTab = ref('runtime')
const refreshCount = ref(0)
const { showMessage, showToast } = useLayoutFeedback()

const kpis = computed(() => [
  { title: '启动耗时', value: `${328 - refreshCount.value * 3}ms`, trend: 'stable', percent: 78 },
  { title: '页面数', value: '6', trend: 'expanded', percent: 100 },
  { title: '配置完整度', value: '100%', trend: 'ready', percent: 100 },
])

const runtimeRows = [
  { title: 'projectArchitecture', note: 'multiPlatform' },
  { title: 'miniprogramRoot', note: 'dist' },
  { title: 'app.miniapp.json', note: 'identity sidecar emitted' },
]

const platformRows = [
  { title: 'Android SDK', note: '1.5.2 / toolkit 0.11.0' },
  { title: 'iOS SDK', note: '1.6.8 / toolkit 0.0.9' },
  { title: 'HarmonyOS SDK', note: '0.5.4' },
]

const currentRows = computed(() => activeTab.value === 'runtime' ? runtimeRows : platformRows)

function onTabChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
  activeTab.value = event.detail.value
}

function refreshData() {
  refreshCount.value += 1
  showToast('数据已刷新')
}

function showRuntimeMessage() {
  showMessage(`当前数据页 tab：${activeTab.value}`)
}
</script>

<template>
  <view class="page">
    <view class="header">
      <view class="title">
        数据总线
      </view>
      <view class="subtitle">
        展示跨端配置、运行指标和平台 SDK 状态。
      </view>
    </view>

    <view class="kpi-grid">
      <view
        v-for="item in kpis"
        :key="item.title"
        class="kpi"
      >
        <view class="kpi-title">
          {{ item.title }}
        </view>
        <view class="kpi-value">
          {{ item.value }}
        </view>
        <t-tag size="small" theme="primary" variant="light">
          {{ item.trend }}
        </t-tag>
        <t-progress :percentage="item.percent" :stroke-width="8" />
      </view>
    </view>

    <view class="panel">
      <t-tabs :value="activeTab" @change="onTabChange">
        <t-tab-panel value="runtime" label="运行时" />
        <t-tab-panel value="platform" label="平台" />
      </t-tabs>
      <t-cell-group>
        <t-cell
          v-for="row in currentRows"
          :key="row.title"
          :title="row.title"
          :note="row.note"
        />
      </t-cell-group>
    </view>

    <view class="actions">
      <t-button theme="primary" block @tap="refreshData">
        刷新数据 Toast
      </t-button>
      <t-button theme="default" variant="outline" block @tap="showRuntimeMessage">
        显示运行时 Message
      </t-button>
    </view>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 32rpx;
}

.header {
  padding: 30rpx;
  color: #0f172a;
  background: #eef6ff;
  border-radius: 16rpx;
}

.title {
  font-size: 38rpx;
  font-weight: 700;
}

.subtitle {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #475569;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 20rpx;
}

.kpi,
.panel {
  padding: 20rpx;
  background: #fff;
  border: 2rpx solid #e2e8f0;
  border-radius: 16rpx;
}

.kpi-title {
  font-size: 22rpx;
  color: #64748b;
}

.kpi-value {
  margin: 8rpx 0;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.panel,
.actions {
  margin-top: 20rpx;
}
</style>
