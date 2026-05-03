<script setup lang="ts">
import { computed } from 'wevu'
import { useRoute, useRouter } from 'wevu/router'

definePageJson({
  navigationBarTitleText: '项目工作台',
})

const HOME_PATH = '/pages/index/index'
const SETTINGS_PATH = '/packageB/pages/settings/index'

const route = useRoute()
const router = useRouter()

const routeSummary = computed(() => route.fullPath || `/${route.path}`)

const taskGroups = [
  {
    title: '待处理任务',
    description: '整理本周迭代的交付清单，确保需求与开发状态同步。',
  },
  {
    title: '风险跟踪',
    description: '识别阻塞项和依赖项，适合继续扩展为真实项目看板。',
  },
  {
    title: '版本准备',
    description: '预留提测、回归和上线前检查的展示区域。',
  },
]

async function toIndependent() {
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
        Workspace
      </view>
      <view class="card__title">
        项目工作台
      </view>
      <view class="card__desc">
        这里适合作为分包内的业务处理入口，例如待办、进度、看板或内部运营模块。
      </view>
      <view class="card__summary">
        当前路由：{{ routeSummary }}
      </view>
    </view>

    <view
      v-for="item in taskGroups"
      :key="item.title"
      class="panel-wrap"
    >
      <InfoPanel
        eyebrow="TASK"
        :title="item.title"
        :description="item.description"
      />
    </view>

    <button class="action-btn action-btn--secondary" @tap="toIndependent">
      前往系统设置
    </button>
    <button class="action-btn action-btn--ghost" @tap="backHome">
      返回业务门户
    </button>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 34rpx 30rpx;
  background:
    radial-gradient(circle at top right, rgb(59 130 246 / 12%), transparent 30%),
    linear-gradient(180deg, #f8fbff 0%, #edf2f9 100%);
}

.card {
  padding: 30rpx 28rpx;
  background: #fff;
  border: 2rpx solid rgb(191 219 254 / 78%);
  border-radius: 30rpx;
  box-shadow: 0 16rpx 36rpx rgb(15 23 42 / 5%);
}

.card__eyebrow {
  font-size: 22rpx;
  font-weight: 600;
  color: #2563eb;
}

.card__title {
  margin-top: 10rpx;
  font-size: 40rpx;
  font-weight: 700;
  color: #172554;
}

.card__desc,
.card__summary {
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #334155;
}

.panel-wrap {
  margin-top: 18rpx;
}

.action-btn {
  margin-top: 18rpx;
  color: #fff;
  background: #2563eb;
  border-radius: 999rpx;
}

.action-btn--secondary {
  background: #0f172a;
}

.action-btn--ghost {
  color: #1d4ed8;
  background: #dbeafe;
}
</style>
