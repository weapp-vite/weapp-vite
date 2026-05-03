<script setup lang="ts">
import { computed } from 'wevu'
import { useRoute, useRouter } from 'wevu/router'

definePageJson({
  navigationBarTitleText: '运营概览',
})

const HOME_PATH = '/pages/index/index'
const WORKSPACE_PATH = '/packageA/pages/workspace/index'
const SETTINGS_PATH = '/packageB/pages/settings/index'

const route = useRoute()
const router = useRouter()

const summary = computed(() => {
  return route.fullPath || `/${route.path}`
})

const focusItems = [
  {
    title: '项目节奏稳定',
    description: '需求冻结、设计评审与联调时间线已经对齐，适合继续扩展到实际业务场景。',
  },
  {
    title: '协作角色清晰',
    description: '可在此基础上继续接入团队成员、审批流或项目动态等正式模块。',
  },
  {
    title: '模板结构简洁',
    description: '页面布局保留必要层级，既能做展示页，也能平滑承接后台工作流。',
  },
]

async function toSettings() {
  await router.push(SETTINGS_PATH)
}

async function backHome() {
  await router.push(HOME_PATH)
}
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="card__eyebrow">
        Overview
      </view>
      <view class="card__title">
        运营概览
      </view>
      <view class="card__desc">
        用正式模板的方式承载项目状态、团队节奏和阶段重点，而不是单纯展示路由跳转能力。
      </view>
      <view class="card__summary">
        当前路由：{{ summary }}
      </view>
    </view>

    <view
      v-for="item in focusItems"
      :key="item.title"
      class="panel-wrap"
    >
      <InfoPanel
        eyebrow="FOCUS"
        :title="item.title"
        :description="item.description"
      />
    </view>

    <view class="actions">
      <button class="action-btn" @tap="router.push(WORKSPACE_PATH)">
        进入项目工作台
      </button>
      <button class="action-btn action-btn--secondary" @tap="toSettings">
        查看系统设置
      </button>
      <button class="action-btn action-btn--ghost" @tap="backHome">
        返回业务门户
      </button>
    </view>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 30rpx;
  background:
    radial-gradient(circle at top left, rgb(16 185 129 / 10%), transparent 28%),
    linear-gradient(180deg, #f6fbf8 0%, #edf5f1 100%);
}

.card {
  padding: 32rpx 28rpx;
  background: #fff;
  border: 2rpx solid #d1fae5;
  border-radius: 30rpx;
  box-shadow: 0 16rpx 36rpx rgb(15 23 42 / 5%);
}

.card__eyebrow {
  font-size: 22rpx;
  font-weight: 600;
  color: #0f766e;
}

.card__title {
  margin-top: 10rpx;
  font-size: 40rpx;
  font-weight: 700;
  color: #134e4a;
}

.card__desc,
.card__summary {
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #335c58;
}

.panel-wrap {
  margin-top: 18rpx;
}

.actions {
  margin-top: 10rpx;
}

.action-btn {
  margin-top: 18rpx;
  color: #fff;
  background: #0f766e;
  border-radius: 999rpx;
}

.action-btn--secondary {
  background: #1d4ed8;
}

.action-btn--ghost {
  color: #134e4a;
  background: #d1fae5;
}
</style>
