<script setup lang="ts">
import { computed, ref } from 'wevu'

import { useLayoutFeedback } from '@/hooks/useLayoutFeedback'

definePageJson({
  navigationBarTitleText: 'Wevu 多端状态',
  usingComponents: {
    't-button': 'tdesign-miniprogram/button/button',
    't-cell': 'tdesign-miniprogram/cell/cell',
    't-cell-group': 'tdesign-miniprogram/cell-group/cell-group',
    't-tabs': 'tdesign-miniprogram/tabs/tabs',
    't-tab-panel': 'tdesign-miniprogram/tab-panel/tab-panel',
  },
})

const enabled = ref(true)
const activeTab = ref('config')
const { showMessage, showToast } = useLayoutFeedback()

const capabilityRows = computed(() => [
  { label: 'Donut project', value: 'multiPlatform' },
  { label: 'Authoring', value: 'Vue SFC' },
  { label: 'Runtime', value: 'wevu' },
  { label: 'Status', value: enabled.value ? 'enabled' : 'disabled' },
])

const configRows = [
  { title: 'componentFramework', note: 'glass-easel' },
  { title: 'miniVersion', note: 'v2' },
  { title: 'runtime config', note: 'dist/app.miniapp.json' },
]

function toggleEnabled() {
  enabled.value = !enabled.value
  showToast(`Status: ${enabled.value ? 'enabled' : 'disabled'}`, enabled.value ? 'success' : 'warning')
}

function onTabChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
  activeTab.value = event.detail.value
}

function showStatusMessage() {
  showMessage(`当前状态页 tab：${activeTab.value}`)
}
</script>

<template>
  <view class="page">
    <view class="header">
      <view class="title">
        Capability Status
      </view>
      <view class="subtitle">
        汇总多端配置、SFC 编译与 wevu 运行时状态。
      </view>
    </view>

    <view class="panel">
      <t-tabs :value="activeTab" @change="onTabChange">
        <t-tab-panel value="config" label="配置" />
        <t-tab-panel value="runtime" label="运行时" />
      </t-tabs>

      <t-cell-group v-if="activeTab === 'config'">
        <t-cell
          v-for="row in configRows"
          :key="row.title"
          :title="row.title"
          :note="row.note"
        />
      </t-cell-group>

      <view v-else>
        <view
          v-for="row in capabilityRows"
          :key="row.label"
          class="row"
        >
          <text class="row__label">
            {{ row.label }}
          </text>
          <text class="row__value">
            {{ row.value }}
          </text>
        </view>
      </view>
    </view>

    <view class="actions">
      <t-button theme="primary" block @tap="toggleEnabled">
        Toggle status
      </t-button>
      <t-button theme="default" variant="outline" block @tap="showStatusMessage">
        Layout message
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

.header,
.panel {
  padding: 24rpx;
  background: #fff;
  border: 2rpx solid #e2e8f0;
  border-radius: 16rpx;
}

.title {
  font-size: 36rpx;
  font-weight: 700;
  color: #0f172a;
}

.subtitle {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.55;
  color: #64748b;
}

.panel,
.actions {
  margin-top: 20rpx;
}

.row {
  display: flex;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 2rpx solid #e2e8f0;
}

.row__label {
  color: #64748b;
}

.row__value {
  font-weight: 700;
  color: #0f172a;
}
</style>
