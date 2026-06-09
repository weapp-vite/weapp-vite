<script setup lang="ts">
import { computed, ref } from 'wevu'
import { useRouter } from 'wevu/router'

import { useLayoutFeedback } from '@/hooks/useLayoutFeedback'

definePageJson({
  navigationBarTitleText: 'Wevu 多端首页',
  usingComponents: {
    't-button': 'tdesign-miniprogram/button/button',
    't-cell': 'tdesign-miniprogram/cell/cell',
    't-cell-group': 'tdesign-miniprogram/cell-group/cell-group',
    't-grid': 'tdesign-miniprogram/grid/grid',
    't-grid-item': 'tdesign-miniprogram/grid-item/grid-item',
    't-notice-bar': 'tdesign-miniprogram/notice-bar/notice-bar',
    't-progress': 'tdesign-miniprogram/progress/progress',
    't-tag': 'tdesign-miniprogram/tag/tag',
  },
})

const router = useRouter()
const taps = ref(0)
const { showMessage, showToast } = useLayoutFeedback()

const cards = [
  {
    title: '微信 Donut 多端',
    detail: 'project.config.json 使用 multiPlatform 架构标记。',
    percent: 100,
  },
  {
    title: 'Vue SFC',
    detail: 'app 与页面都由 .vue 编译生成小程序入口。',
    percent: 96,
  },
  {
    title: 'wevu runtime',
    detail: '页面状态、计算属性和事件都来自 wevu。',
    percent: 92,
  },
]

const quickRoutes = [
  { text: '数据', path: '/pages/data/index', icon: 'chart-bubble' },
  { text: '表单', path: '/pages/form/index', icon: 'edit-1' },
  { text: '能力', path: '/pages/ability/index', icon: 'app' },
  { text: '资料', path: '/pages/profile/index?from=index', icon: 'user' },
  { text: '布局', path: '/pages/layouts/index', icon: 'view-module' },
]

const checklist = [
  { title: '多端项目标记', note: 'projectArchitecture=multiPlatform' },
  { title: '运行时配置', note: 'app.miniapp.json sidecar' },
  { title: 'SFC 页面', note: '<script setup> + TDesign' },
]

const e2eState = computed(() => ({
  status: 'ready',
  fixture: 'donut-multi-end-wevu-sfc',
  routeCount: quickRoutes.length,
  taps: taps.value,
}))

function recordTap() {
  taps.value += 1
  showToast(`Record tap: ${taps.value}`)
}

async function openRoute(path: string) {
  await router.push(path)
}

async function openProfile() {
  await router.push('/pages/profile/index?from=index')
}

async function openStatus() {
  await router.push('/pages/status/index')
}

function showHomeMessage() {
  showMessage('首页通过 default layout 触发 Message')
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <view class="eyebrow">
        WEAPP-VITE + WEVU
      </view>
      <view class="title">
        多端项目 SFC Fixture
      </view>
      <view class="subtitle">
        使用 Vue SFC 生成 app、页面和样式，同时保留微信 Donut 多端项目配置。
      </view>
      <view class="tags">
        <t-tag size="small" theme="primary" variant="light">
          multiPlatform
        </t-tag>
        <t-tag size="small" theme="success" variant="light">
          TDesign
        </t-tag>
        <t-tag size="small" theme="warning" variant="light">
          wevu
        </t-tag>
      </view>
    </view>

    <view class="notice">
      <t-notice-bar theme="info" content="Donut 多端工程已覆盖原生配置、SFC 页面、TDesign 组件和运行时状态。" />
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
        Routes: {{ e2eState.routeCount }}
      </view>
      <view class="row">
        Taps: {{ e2eState.taps }}
      </view>
      <button class="action" @tap="recordTap">
        Record tap
      </button>
    </view>

    <view class="grid-panel">
      <t-grid column="5">
        <t-grid-item
          v-for="item in quickRoutes"
          :key="item.path"
          :text="item.text"
          :icon="item.icon"
          @tap="openRoute(item.path)"
        />
      </t-grid>
    </view>

    <view class="cards">
      <view
        v-for="card in cards"
        :key="card.title"
        class="card"
      >
        <view class="card__header">
          <view class="card__title">
            {{ card.title }}
          </view>
          <t-tag size="small" theme="primary" variant="light">
            {{ card.percent }}%
          </t-tag>
        </view>
        <view class="card__detail">
          {{ card.detail }}
        </view>
        <t-progress :percentage="card.percent" :stroke-width="8" />
      </view>
    </view>

    <view class="panel">
      <t-cell-group>
        <t-cell
          v-for="item in checklist"
          :key="item.title"
          :title="item.title"
          :note="item.note"
        />
      </t-cell-group>
    </view>

    <view class="actions">
      <t-button class="action-button" theme="primary" block @tap="openProfile">
        Open profile
      </t-button>
      <t-button class="action-button" theme="default" variant="outline" block @tap="openStatus">
        Open status
      </t-button>
      <t-button class="action-button" theme="success" variant="outline" block @tap="showHomeMessage">
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

.hero {
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

.tags,
.actions,
.card__header {
  display: flex;
  gap: 12rpx;
  align-items: center;
}

.tags {
  flex-wrap: wrap;
  margin-top: 18rpx;
}

.notice,
.grid-panel,
.panel,
.card {
  margin-top: 20rpx;
}

.grid-panel,
.panel,
.card {
  padding: 24rpx;
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

.card__header {
  justify-content: space-between;
}

.actions {
  margin-top: 22rpx;
}

.action-button {
  flex: 1;
}

.action {
  margin-top: 18rpx;
  color: #fff;
  background: #0f766e;
  border-radius: 999rpx;
}
</style>
