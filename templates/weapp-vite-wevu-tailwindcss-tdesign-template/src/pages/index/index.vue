<script setup lang="ts">
import type { QuickActionItem } from '@/types/action'

import { computed, getCurrentInstance, ref, resolveLayoutBridge, resolveLayoutHost, watch } from 'wevu'
import KpiBoard from '@/components/KpiBoard/index.vue'
import QuickActionGrid from '@/components/QuickActionGrid/index.vue'
import { LAYOUT_TOAST_BRIDGE_KEY } from '@/hooks/useLayoutFeedbackBridge'
import { usePullDownRefresh } from '@/hooks/usePullDownRefresh'
import { useToast } from '@/hooks/useToast'

definePageJson({
  navigationBarTitleText: '首页',
  enablePullDownRefresh: true,
  backgroundColor: '#f6f7fb',
})

const { showToast } = useToast()
const pageInstance = getCurrentInstance<any>()

const noticeText = ref('欢迎体验 wevu + weapp-vite + TDesign 模板，已启用分包与多页面导航。')
const lastUpdated = ref('刚刚')
const refreshSeed = ref(1)

const kpiItems = computed(() => {
  const seed = refreshSeed.value
  return [
    {
      key: 'visits',
      label: '今日访问',
      value: 1280 + seed * 3,
      unit: '次',
      delta: 6 + seed,
      footnote: '较昨日',
    },
    {
      key: 'conversion',
      label: '转化率',
      value: 24 + seed,
      unit: '%',
      delta: 2,
      footnote: '近 7 日',
    },
    {
      key: 'tickets',
      label: '待处理',
      value: 18 - seed,
      unit: '单',
      delta: -1,
      footnote: '来自清单',
    },
    {
      key: 'satisfaction',
      label: '满意度',
      value: 4.8,
      unit: '分',
      delta: 0.2,
      footnote: '客服评分',
    },
  ]
})

const quickActions = ref<QuickActionItem[]>([
  {
    key: 'data',
    title: '数据洞察',
    description: '仪表盘与趋势',
    icon: 'chart-analytics',
    tag: 'KPI',
    tone: 'brand',
    path: '/pages/data/index',
    type: 'tab',
  },
  {
    key: 'form',
    title: '流程表单',
    description: '多步录入',
    icon: 'edit-1',
    tag: 'Flow',
    tone: 'neutral',
    path: '/pages/form/index',
    type: 'tab',
  },
  {
    key: 'list',
    title: '清单看板',
    description: '筛选与列表',
    icon: 'view-list',
    tag: 'List',
    tone: 'neutral',
    path: '/pages/list/index',
    type: 'tab',
  },
  {
    key: 'ability',
    title: '能力中心',
    description: '小程序 API',
    icon: 'app',
    tag: 'API',
    tone: 'brand',
    path: '/pages/ability/index',
    type: 'tab',
  },
  {
    key: 'layouts',
    title: '布局能力',
    description: 'default / admin / false',
    icon: 'layers',
    tag: 'Layout',
    tone: 'brand',
    path: '/pages/layouts/index',
    type: 'sub',
  },
  {
    key: 'layout-feedback',
    title: 'Layout 通信',
    description: '页面/组件调用 layout',
    icon: 'chat-bubble',
    tag: 'Bridge',
    tone: 'brand',
    path: '/pages/layout-feedback/index',
    type: 'sub',
  },
  {
    key: 'layout-store',
    title: 'Store 调用 Layout',
    description: 'store 驱动 layout 宿主',
    icon: 'layers',
    tag: 'Store',
    tone: 'brand',
    path: '/pages/layout-store/index',
    type: 'sub',
  },
  {
    key: 'lab',
    title: '组件实验室',
    description: 'TDesign 组件',
    icon: 'grid-view',
    tag: 'Lab',
    tone: 'neutral',
    path: '/subpackages/lab/index',
    type: 'sub',
  },
  {
    key: 'class-binding',
    title: 'Class 绑定',
    description: '对象/数组语法',
    icon: 'grid-view',
    tag: 'Vue',
    tone: 'brand',
    path: '/subpackages/lab/class-binding/index',
    type: 'sub',
  },
  {
    key: 'ability-lab',
    title: 'API 场景',
    description: '系统信息',
    icon: 'share',
    tag: 'Sub',
    tone: 'neutral',
    path: '/subpackages/ability/index',
    type: 'sub',
  },
])

const featureTags = [
  'Composition API',
  'SubPackages',
  'Auto Import',
  'Tailwind',
]

watch(refreshSeed, () => {
  lastUpdated.value = `更新于 ${new Date().toLocaleTimeString()}`
})

function nextRefreshSeedValue() {
  return refreshSeed.value >= 9 ? 1 : refreshSeed.value + 1
}

function refreshDashboard() {
  refreshSeed.value = nextRefreshSeedValue()
  showToast('指标已刷新')
}

function inspectLayoutToastBridge() {
  const bridge = resolveLayoutBridge(LAYOUT_TOAST_BRIDGE_KEY, pageInstance)
  const layoutByPage = pageInstance?.selectComponent?.('weapp-layout-default')
    ?? pageInstance?.selectComponent?.('.weapp-layout-default')
    ?? null
  const toastFromBridge = resolveLayoutHost(LAYOUT_TOAST_BRIDGE_KEY, { context: pageInstance })

  return {
    bridgeResolved: Boolean(bridge),
    bridgeIsPage: bridge === pageInstance,
    bridgeHasSelectComponent: typeof bridge?.selectComponent === 'function',
    layoutFoundByPage: Boolean(layoutByPage),
    toastFoundByBridge: Boolean(toastFromBridge),
    bridgeKeys: bridge ? Object.keys(bridge).slice(0, 20) : [],
    layoutKeys: layoutByPage ? Object.keys(layoutByPage).slice(0, 20) : [],
  }
}

void inspectLayoutToastBridge

function runLayoutToastE2E() {
  refreshSeed.value = nextRefreshSeedValue()
  const bridgeState = inspectLayoutToastBridge()
  setTimeout(() => {
    showToast('指标已刷新')
  }, 0)
  return {
    ...bridgeState,
    refreshSeed: refreshSeed.value,
  }
}

void runLayoutToastE2E

usePullDownRefresh(refreshDashboard)

function onQuickAction(action: QuickActionItem) {
  if (!action.path) {
    showToast('该入口暂未配置')
    return
  }
  if (action.type === 'tab') {
    wx.switchTab({
      url: action.path,
    })
    return
  }
  wx.navigateTo({
    url: action.path,
  })
}
</script>

<template>
  <view class="min-h-screen bg-[#f6f7fb] px-[28rpx] pb-[88rpx] pt-[32rpx] text-[#1c1c3c]">
    <view class="rounded-[28rpx] bg-gradient-to-br from-[#2f2b5f] via-[#3b3573] to-[#5a48c5] p-[24rpx] text-white shadow-[0_24rpx_48rpx_rgba(47,43,95,0.35)]">
      <text class="text-[38rpx] font-semibold">
        Weapp Studio
      </text>
      <text class="mt-[8rpx] block text-[22rpx] text-white/80">
        以场景驱动的模板，展示 wevu、weapp-vite 与 TDesign。
      </text>
      <view class="mt-[12rpx] flex flex-wrap gap-[8rpx]">
        <t-tag v-for="tag in featureTags" :key="tag" size="small" theme="primary" variant="dark">
          {{ tag }}
        </t-tag>
      </view>
      <view class="mt-[16rpx] flex items-center justify-between">
        <text class="text-[20rpx] text-white/70">
          {{ lastUpdated }}
        </text>
        <view id="refresh-dashboard-trigger" @tap="refreshDashboard">
          <t-button size="small" theme="default" variant="outline">
            刷新指标
          </t-button>
        </view>
      </view>
    </view>

    <view class="mt-[16rpx]">
      <t-notice-bar theme="info" :content="noticeText" />
    </view>

    <view class="mt-[20rpx]">
      <KpiBoard title="今日概览" subtitle="实时跟踪业务健康度" :items="kpiItems">
        <template #action>
          <t-button size="small" theme="primary" variant="outline" @tap="refreshDashboard">
            重新计算
          </t-button>
        </template>
        <template #items="{ items }">
          <view v-for="card in items" :key="card.key" class="rounded-[18rpx] bg-[#f4f6ff] p-[16rpx]">
            <view class="flex items-center justify-between">
              <text class="text-[22rpx] text-[#51517c]">
                {{ card.item.label }}
              </text>
              <t-tag v-if="card.isLeading" size="small" theme="warning" variant="light">
                热点
              </t-tag>
            </view>
            <view class="mt-[12rpx] flex items-end justify-between">
              <view class="flex items-baseline gap-[6rpx]">
                <text class="text-[32rpx] font-semibold text-[#1f1a3f]">
                  {{ card.item.value }}
                </text>
                <text v-if="card.item.unit" class="text-[20rpx] text-[#7a7aa0]">
                  {{ card.item.unit }}
                </text>
              </view>
              <text
                class="text-[20rpx] font-semibold"
                :class="card.tone === 'positive' ? 'text-[#1b7a3a]' : card.tone === 'negative' ? 'text-[#b42318]' : 'text-[#64748b]'"
              >
                {{ card.tone === 'positive' ? '↑' : card.tone === 'negative' ? '↓' : '→' }}
                {{ card.item.delta ?? '--' }}
              </text>
            </view>
            <text v-if="card.item.footnote" class="mt-[6rpx] block text-[20rpx] text-[#7a7aa0]">
              {{ card.item.footnote }}
            </text>
          </view>
        </template>
      </KpiBoard>
    </view>

    <view class="mt-[20rpx]">
      <QuickActionGrid
        title="快速入口"
        subtitle="覆盖主包与分包页面"
        :items="quickActions"
        @select="onQuickAction"
      />
    </view>

    <view class="mt-[20rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <view class="flex items-center justify-between">
        <text class="text-[26rpx] font-semibold text-[#1f1a3f]">
          Class 绑定示例
        </text>
        <t-tag size="small" theme="primary" variant="light">
          模板
        </t-tag>
      </view>
      <view class="mt-[12rpx] flex flex-col gap-[12rpx]">
        <view
          class="rounded-[16rpx] px-[16rpx] py-[12rpx] text-[20rpx]"
          :class="{
            'bg-[#eef2ff]': refreshSeed % 2 === 0,
            'text-[#1f1a3f]': refreshSeed % 2 === 0,
            'bg-[#fff7ed]': refreshSeed % 2 !== 0,
            'text-[#92400e]': refreshSeed % 2 !== 0,
            'ring-2 ring-[#6366f1]': refreshSeed % 3 === 0,
          }"
        >
          对象语法：根据刷新次数切换配色与高亮
        </view>
        <view
          class="rounded-[16rpx] px-[16rpx] py-[12rpx] text-[20rpx]" :class="[
            refreshSeed % 2 === 0 ? 'bg-[#ecfeff] text-[#0f766e]' : 'bg-[#fef2f2] text-[#991b1b]',
            refreshSeed % 4 === 0
              ? 'shadow-[0_10rpx_18rpx_rgba(15,118,110,0.18)]'
              : 'shadow-[0_10rpx_18rpx_rgba(153,27,27,0.18)]',
          ]"
        >
          数组语法：组合静态与条件 class
        </view>
        <view
          class="rounded-[16rpx] border border-[#e2e8f0] px-[16rpx] py-[12rpx] text-[20rpx]"
          :class="refreshSeed % 2 === 0 ? 'bg-[#f8fafc] text-[#334155]' : 'bg-[#111827] text-white'"
        >
          class + :class 合并：静态边框叠加动态背景
        </view>
      </view>
    </view>

    <view class="mt-[20rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <view class="flex items-center justify-between">
        <text class="text-[26rpx] font-semibold text-[#1f1a3f]">
          体验清单
        </text>
        <t-tag size="small" theme="primary" variant="light">
          指南
        </t-tag>
      </view>
      <view class="mt-[12rpx]">
        <t-cell-group>
          <t-cell title="多页面 TabBar" note="首页/数据/表单/清单/能力" />
          <t-cell title="分包加载" note="组件实验室与 API 场景" />
          <t-cell title="Composition API" note="ref/computed/watch 驱动" />
          <t-cell title="TDesign 组件" note="表单、列表、反馈" />
        </t-cell-group>
      </view>
    </view>
  </view>
</template>
