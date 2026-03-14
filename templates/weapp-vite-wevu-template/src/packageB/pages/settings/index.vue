<script setup lang="ts">
import { computed } from 'wevu'
import { useRoute, useRouter } from 'wevu/router'

definePageJson({
  navigationBarTitleText: '系统设置',
})

const HOME_PATH = '/pages/index/index'
const OVERVIEW_PATH = '/pages/overview/index'

const route = useRoute()
const router = useRouter()

const routeSummary = computed(() => route.fullPath || `/${route.path}`)

const settingGroups = [
  {
    title: '通知策略',
    description: '预留站内消息、邮件提醒和审批通知等配置位置。',
  },
  {
    title: '角色权限',
    description: '适合接入组织结构、角色分级与操作授权等业务能力。',
  },
  {
    title: '环境信息',
    description: '可以继续扩展版本号、发布通道和系统参数等正式模块。',
  },
]

async function relaunchHome() {
  await router.nativeRouter.reLaunch({
    url: HOME_PATH,
  })
}
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="card__eyebrow">
        Settings
      </view>
      <view class="card__title">
        系统设置
      </view>
      <view class="card__desc">
        独立分包适合作为设置、配置或低频但相对独立的业务模块承载区。
      </view>
      <view class="card__summary">
        当前路由：{{ routeSummary }}
      </view>
    </view>

    <view
      v-for="item in settingGroups"
      :key="item.title"
      class="panel-wrap"
    >
      <InfoPanel
        eyebrow="SETTING"
        :title="item.title"
        :description="item.description"
      />
    </view>

    <button class="action-btn" @tap="router.push(OVERVIEW_PATH)">
      查看运营概览
    </button>
    <button class="action-btn action-btn--ghost" @tap="relaunchHome">
      reLaunch 回业务门户
    </button>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 34rpx 30rpx;
  background:
    radial-gradient(circle at top left, rgb(148 163 184 / 14%), transparent 26%),
    linear-gradient(180deg, #f8fafc 0%, #eef2f6 100%);
}

.card {
  padding: 30rpx 28rpx;
  background: #fff;
  border: 2rpx solid #cbd5e1;
  border-radius: 30rpx;
  box-shadow: 0 16rpx 36rpx rgb(15 23 42 / 5%);
}

.card__eyebrow {
  font-size: 22rpx;
  font-weight: 600;
  color: #475569;
}

.card__title {
  margin-top: 10rpx;
  font-size: 40rpx;
  font-weight: 700;
  color: #0f172a;
}

.card__desc,
.card__summary {
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #475569;
}

.panel-wrap {
  margin-top: 18rpx;
}

.action-btn {
  margin-top: 18rpx;
  color: #fff;
  background: #0f172a;
  border-radius: 999rpx;
}

.action-btn--ghost {
  color: #0f172a;
  background: #e2e8f0;
}
</style>
