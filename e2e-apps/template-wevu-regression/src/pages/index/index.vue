<script setup lang="ts">
import { computed } from 'wevu'
import { useRoute, useRouter } from 'wevu/router'

definePageJson({
  navigationBarTitleText: '业务门户',
})

const HOME_PATH = '/pages/index/index'
const OVERVIEW_PATH = '/pages/overview/index'
const WORKSPACE_PATH = '/packageA/pages/workspace/index'
const SETTINGS_PATH = '/packageB/pages/settings/index'
const LAYOUTS_PATH = '/pages/layouts/index'

const route = useRoute()
const router = useRouter()
const routeSummary = computed(() => route.fullPath || `/${route.path}`)

const metrics = [
  { label: '本周跟进事项', value: '12', detail: '含 3 项需今日确认' },
  { label: '交付进度', value: '86%', detail: '版本提测准备完成' },
  { label: '服务可用率', value: '99.95%', detail: '核心链路运行稳定' },
]

const quickLinks = [
  {
    title: '运营概览',
    description: '查看阶段目标、团队协同与项目节奏。',
    action: '进入概览',
    path: OVERVIEW_PATH,
  },
  {
    title: '项目工作台',
    description: '集中处理待办任务、优先级与排期。',
    action: '打开工作台',
    path: WORKSPACE_PATH,
  },
  {
    title: '系统设置',
    description: '统一管理通知、权限与环境配置。',
    action: '前往设置',
    path: SETTINGS_PATH,
  },
  {
    title: '页面布局',
    description: '体验 default/admin/false 三种页面壳切换方式。',
    action: '打开布局页',
    path: LAYOUTS_PATH,
  },
]

async function pushTo(path: string) {
  await router.push(path)
}

async function relaunchToHome() {
  await router.nativeRouter.reLaunch({
    url: HOME_PATH,
  })
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <view class="hero__eyebrow">
        企业业务模板
      </view>
      <view class="hero__title">
        适合作为正式项目起点的首页框架
      </view>
      <view class="hero__desc">
        内置主包与分包页面结构、统一导航入口与简洁信息模块，默认呈现正式、克制且便于继续扩展的业务模板风格。
      </view>
      <view class="hero__pills">
        <StatusPill label="主包首页" tone="accent" />
        <StatusPill label="可扩展分包" tone="neutral" />
        <StatusPill label="适合二次开发" tone="success" />
      </view>
    </view>

    <view class="section">
      <view class="section__title">
        核心指标
      </view>
      <view
        v-for="item in metrics"
        :key="item.label"
        class="metric-card"
      >
        <view class="metric-card__label">
          {{ item.label }}
        </view>
        <view class="metric-card__value">
          {{ item.value }}
        </view>
        <view class="metric-card__detail">
          {{ item.detail }}
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section__title">
        常用入口
      </view>
      <view
        v-for="link in quickLinks"
        :key="link.path"
        class="entry-card"
      >
        <InfoPanel
          eyebrow="PAGE"
          :title="link.title"
          :description="link.description"
        />
        <button class="action-btn" @tap="pushTo(link.path)">
          {{ link.action }}
        </button>
      </view>
    </view>

    <view class="section">
      <InfoPanel
        eyebrow="ROUTER"
        title="导航状态"
        description="模板保留路由能力作为底层基础，但将其放在辅助信息层，避免首页呈现为技术功能演示页。"
      />
      <view class="route-note">
        当前路由：{{ routeSummary }}
      </view>
      <button class="action-btn action-btn--light" @tap="relaunchToHome">
        reLaunch 当前首页
      </button>
    </view>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 28rpx 28rpx 40rpx;
  background:
    radial-gradient(circle at top right, rgb(59 130 246 / 12%), transparent 30%),
    linear-gradient(180deg, #f8fafc 0%, #eef3f8 100%);
}

.hero {
  padding: 36rpx 30rpx;
  background: linear-gradient(160deg, #0f172a, #1e293b 72%, #334155);
  border-radius: 32rpx;
  box-shadow: 0 24rpx 60rpx rgb(15 23 42 / 18%);
}

.hero__eyebrow {
  font-size: 22rpx;
  font-weight: 600;
  color: rgb(226 232 240 / 88%);
  letter-spacing: 2rpx;
}

.hero__title {
  margin-top: 16rpx;
  font-size: 42rpx;
  font-weight: 700;
  line-height: 1.35;
  color: #fff;
}

.hero__desc {
  margin-top: 16rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: rgb(226 232 240 / 88%);
}

.hero__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 24rpx;
}

.section {
  margin-top: 24rpx;
}

.section__title {
  margin-bottom: 16rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: #0f172a;
}

.metric-card,
.entry-card {
  padding: 24rpx;
  margin-top: 16rpx;
  background: rgb(255 255 255 / 92%);
  border: 2rpx solid rgb(226 232 240 / 88%);
  border-radius: 28rpx;
  box-shadow: 0 12rpx 32rpx rgb(15 23 42 / 4%);
}

.metric-card__label {
  font-size: 22rpx;
  color: #64748b;
}

.metric-card__value {
  margin-top: 12rpx;
  font-size: 44rpx;
  font-weight: 700;
  color: #0f172a;
}

.metric-card__detail {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #475569;
}

.route-note {
  margin-top: 16rpx;
  font-size: 22rpx;
  color: #64748b;
}

.action-btn {
  margin-top: 18rpx;
  color: #fff;
  background: #0f172a;
  border-radius: 999rpx;
}

.action-btn--light {
  color: #0f172a;
  background: #e2e8f0;
}
</style>
