<script setup lang="ts">
import { computed, ref } from 'wevu'
import { useRouter } from 'wevu/router'

definePageJson({
  navigationBarTitleText: 'Wevu 多端首页',
})

const router = useRouter()
const taps = ref(0)
const cards = [
  {
    title: '微信 Donut 多端',
    detail: 'project.config.json 使用 multiPlatform 架构标记。',
  },
  {
    title: 'Vue SFC',
    detail: 'app 与页面都由 .vue 编译生成小程序入口。',
  },
  {
    title: 'wevu runtime',
    detail: '页面状态、计算属性和事件都来自 wevu。',
  },
]

const e2eState = computed(() => ({
  status: 'ready',
  fixture: 'donut-multi-end-wevu-sfc',
  taps: taps.value,
}))

function recordTap() {
  taps.value += 1
}

async function openProfile() {
  await router.push('/pages/profile/index?from=index')
}

async function openStatus() {
  await router.push('/pages/status/index')
}
</script>

<template>
  <view class="page">
    <view class="header">
      <view class="eyebrow">
        WEAPP-VITE + WEVU
      </view>
      <view class="title">
        多端项目 SFC Fixture
      </view>
      <view class="subtitle">
        使用 Vue SFC 生成 app、页面和样式，同时保留微信 Donut 多端项目配置。
      </view>
    </view>

    <view class="panel">
      <view class="panel__title">
        E2E State
      </view>
      <view class="row">
        Status: {{ e2eState.status }}
      </view>
      <view class="row">
        Fixture: {{ e2eState.fixture }}
      </view>
      <view class="row">
        Taps: {{ e2eState.taps }}
      </view>
      <button class="action" @tap="recordTap">
        Record tap
      </button>
    </view>

    <view class="cards">
      <view
        v-for="card in cards"
        :key="card.title"
        class="card"
      >
        <view class="card__title">
          {{ card.title }}
        </view>
        <view class="card__detail">
          {{ card.detail }}
        </view>
      </view>
    </view>

    <view class="actions">
      <button class="action" @tap="openProfile">
        Open profile
      </button>
      <button class="action action--light" @tap="openStatus">
        Open status
      </button>
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
  padding: 32rpx;
  color: #fff;
  background: linear-gradient(140deg, #0f766e, #1d4ed8);
  border-radius: 16rpx;
}

.eyebrow {
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.title {
  margin-top: 16rpx;
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.35;
}

.subtitle {
  margin-top: 14rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: rgb(255 255 255 / 86%);
}

.panel,
.card {
  padding: 24rpx;
  margin-top: 20rpx;
  background: #fff;
  border: 2rpx solid #e2e8f0;
  border-radius: 16rpx;
}

.panel__title,
.card__title {
  font-size: 28rpx;
  font-weight: 700;
  color: #0f172a;
}

.row,
.card__detail {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.55;
  color: #475569;
}

.actions {
  display: flex;
  gap: 16rpx;
  margin-top: 22rpx;
}

.action {
  margin-top: 18rpx;
  color: #fff;
  background: #0f766e;
  border-radius: 999rpx;
}

.actions .action {
  flex: 1;
  margin-top: 0;
}

.action--light {
  color: #0f172a;
  background: #dbeafe;
}
</style>
