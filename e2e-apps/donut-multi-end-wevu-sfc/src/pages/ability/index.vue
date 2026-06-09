<script setup lang="ts">
import { ref } from 'wevu'
import { useRouter } from 'wevu/router'

definePageJson({
  navigationBarTitleText: 'Wevu 多端能力',
  usingComponents: {
    't-button': 'tdesign-miniprogram/button/button',
    't-cell': 'tdesign-miniprogram/cell/cell',
    't-cell-group': 'tdesign-miniprogram/cell-group/cell-group',
    't-divider': 'tdesign-miniprogram/divider/divider',
    't-empty': 'tdesign-miniprogram/empty/empty',
    't-tag': 'tdesign-miniprogram/tag/tag',
  },
})

const router = useRouter()
const lastAction = ref('idle')
const capabilityRows = [
  { title: '剪贴板', note: 'wx.setClipboardData' },
  { title: '分享菜单', note: 'wx.showShareMenu' },
  { title: '页面导航', note: 'navigateTo / reLaunch' },
]

function copyToken() {
  wx.setClipboardData({
    data: 'donut-multi-end-wevu-sfc',
    success: () => {
      lastAction.value = 'clipboard'
    },
  })
}

function enableShare() {
  wx.showShareMenu({
    withShareTicket: true,
    complete: () => {
      lastAction.value = 'share-menu'
    },
  })
}

async function openProfile() {
  await router.push('/pages/profile/index?from=ability')
}
</script>

<template>
  <view class="page">
    <view class="header">
      <view class="title">
        能力矩阵
      </view>
      <view class="subtitle">
        以低风险 API 展示 App 与小程序共用的能力入口。
      </view>
    </view>

    <view class="panel">
      <view class="status-line">
        <text>Last action</text>
        <t-tag theme="primary" variant="light">
          {{ lastAction }}
        </t-tag>
      </view>
      <t-divider content="Native API" />
      <t-cell-group>
        <t-cell
          v-for="item in capabilityRows"
          :key="item.title"
          :title="item.title"
          :note="item.note"
        />
      </t-cell-group>
    </view>

    <view class="actions">
      <t-button theme="primary" block @tap="copyToken">
        复制标识
      </t-button>
      <t-button theme="default" block variant="outline" @tap="enableShare">
        开启分享
      </t-button>
      <t-button theme="primary" block variant="outline" @tap="openProfile">
        打开资料页
      </t-button>
    </view>

    <view class="empty">
      <t-empty description="更多真机能力由 DevTools 多端模式验证" />
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
.panel,
.empty {
  padding: 24rpx;
  background: #fff;
  border: 2rpx solid #e2e8f0;
  border-radius: 16rpx;
}

.header {
  background: #ecfeff;
}

.title {
  font-size: 38rpx;
  font-weight: 700;
  color: #0f172a;
}

.subtitle {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.55;
  color: #64748b;
}

.panel,
.actions,
.empty {
  margin-top: 20rpx;
}

.status-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 24rpx;
  color: #334155;
}

.actions {
  display: grid;
  gap: 14rpx;
}
</style>
