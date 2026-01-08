<script setup lang="ts">
import { computed, ref, watch } from 'wevu'

import KpiBoard from '@/components/KpiBoard/index.vue'
import SectionTitle from '@/components/SectionTitle/index.vue'
import TrendCard from '@/components/TrendCard/index.vue'

definePageJson({
  navigationBarTitleText: '数据',
  backgroundColor: '#f6f7fb',
})

const ranges = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
]

const activeRange = ref('week')
const refreshTick = ref(0)

const kpiItems = computed(() => {
  const scale = activeRange.value === 'today' ? 1 : activeRange.value === 'month' ? 4 : 2
  const drift = refreshTick.value
  return [
    {
      key: 'orders',
      label: '订单量',
      value: 268 * scale + drift,
      unit: '单',
      delta: 12 + drift,
      footnote: '核心目标',
    },
    {
      key: 'gmv',
      label: '成交额',
      value: 42 * scale + drift,
      unit: '万',
      delta: 3 + drift,
      footnote: 'GMV',
    },
    {
      key: 'retention',
      label: '留存',
      value: 62 + drift,
      unit: '%',
      delta: 4,
      footnote: '用户粘性',
    },
    {
      key: 'nps',
      label: 'NPS',
      value: 48 + drift,
      unit: '分',
      delta: 2,
      footnote: '满意度',
    },
  ]
})

const trends = computed(() => [
  {
    key: 'active',
    title: '活跃用户',
    value: activeRange.value === 'today' ? 980 : activeRange.value === 'month' ? 8820 : 3560,
    unit: '人',
    delta: 12 + refreshTick.value,
    progress: 78,
  },
  {
    key: 'conversion',
    title: '转化漏斗',
    value: activeRange.value === 'today' ? 21 : activeRange.value === 'month' ? 25 : 23,
    unit: '%',
    delta: 1,
    progress: 56,
  },
  {
    key: 'response',
    title: '响应时长',
    value: activeRange.value === 'today' ? 1.6 : 1.8,
    unit: 's',
    delta: -0.2,
    progress: 68,
  },
])

const reportLines = computed(() => [
  `分组：${ranges.find(range => range.value === activeRange.value)?.label ?? '本周'}`,
  '渠道贡献 Top3：直播、社群、搜索',
  '重点事项：提升转化 > 优化留存',
])

function onRangeChange(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
  activeRange.value = e.detail.value
}

watch(activeRange, () => {
  refreshTick.value = Math.floor(Math.random() * 6)
})
</script>

<template>
  <view class="min-h-screen bg-[#f6f7fb] px-[28rpx] pb-[88rpx] pt-[24rpx] text-[#1c1c3c]">
    <view class="rounded-[28rpx] bg-gradient-to-br from-[#f1f5ff] via-[#eef2ff] to-[#ffffff] p-[20rpx]">
      <SectionTitle title="经营仪表盘" subtitle="聚焦关键指标与趋势" />
      <view class="mt-[12rpx]">
        <t-tabs :value="activeRange" @change="onRangeChange">
          <t-tab-panel v-for="range in ranges" :key="range.value" :value="range.value" :label="range.label" />
        </t-tabs>
      </view>
    </view>

    <view class="mt-[18rpx]">
      <KpiBoard title="核心 KPI" subtitle="趋势随区间自动刷新" :items="kpiItems">
        <template #action />
        <template #items="{ items }">
          <view v-for="card in items" :key="card.key">
            <view class="rounded-[18rpx] bg-[#f7f7fb] p-[16rpx]">
              <view class="flex items-center justify-between">
                <view class="flex items-center gap-[8rpx]">
                  <view class="h-[8rpx] w-[8rpx] rounded-full" :class="card.tone === 'positive' ? 'bg-[#22c55e]' : card.tone === 'negative' ? 'bg-[#ef4444]' : 'bg-[#94a3b8]'" />
                  <text class="text-[22rpx] text-[#61618a]">
                    {{ card.item.label }}
                  </text>
                </view>
                <view v-if="card.isLeading" class="rounded-full bg-[#fff3c2] px-[10rpx] py-[4rpx]">
                  <text class="text-[18rpx] font-semibold text-[#8a5200]">
                    HOT
                  </text>
                </view>
              </view>
              <view class="mt-[10rpx] flex items-end justify-between">
                <view class="flex items-baseline gap-[6rpx]">
                  <text class="text-[32rpx] font-bold text-[#1c1c3c]">
                    {{ card.item.value }}
                  </text>
                  <text v-if="card.item.unit" class="text-[20rpx] text-[#7a7aa0]">
                    {{ card.item.unit }}
                  </text>
                </view>
                <view
                  class="rounded-full px-[10rpx] py-[4rpx]"
                  :class="card.tone === 'positive' ? 'bg-[#e7f7ee] text-[#1b7a3a]' : card.tone === 'negative' ? 'bg-[#ffe9e9] text-[#b42318]' : 'bg-[#edf1f7] text-[#64748b]'"
                >
                  <text class="text-[20rpx] font-semibold">
                    {{ card.tone === 'positive' ? '↑' : card.tone === 'negative' ? '↓' : '→' }}
                    {{ card.item.delta === undefined ? '--' : String(card.item.delta) + (card.item.unit ? card.item.unit : '') }}
                  </text>
                </view>
              </view>
              <text v-if="card.item.footnote" class="mt-[6rpx] block text-[20rpx] text-[#8a8aa5]">
                {{ card.item.footnote }}
              </text>
            </view>
          </view>
        </template>
      </KpiBoard>
    </view>

    <view class="mt-[18rpx]">
      <SectionTitle title="趋势追踪" subtitle="转化与体验指标" />
      <view class="mt-[12rpx] grid gap-[12rpx]">
        <TrendCard
          v-for="card in trends"
          :key="card.key"
          :title="card.title"
          :value="card.value"
          :unit="card.unit"
          :delta="card.delta"
          :progress="card.progress"
        />
      </view>
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <SectionTitle title="经营洞察" subtitle="跟进重点事项" />
      <view class="mt-[12rpx] space-y-[10rpx]">
        <view v-for="line in reportLines" :key="line" class="flex items-center gap-[8rpx]">
          <view class="h-[8rpx] w-[8rpx] rounded-full bg-[#5a48c5]" />
          <text class="text-[22rpx] text-[#4c4b68]">
            {{ line }}
          </text>
        </view>
      </view>
    </view>
  </view>
</template>
