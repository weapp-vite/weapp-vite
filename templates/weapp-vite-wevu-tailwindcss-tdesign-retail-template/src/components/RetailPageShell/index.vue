<script setup lang="ts">
import { computed } from 'wevu'
import { getRetailNeighbors, resolveRetailRoute, RETAIL_ROUTES, RETAIL_TAB_ROUTES } from '@/constants/routes'
import { useMokupScene } from '@/hooks/useMokupScene'

const props = defineProps<{
  route: string
}>()

const routeMeta = computed(() => {
  return resolveRetailRoute(props.route)
})

const { scene, loading, refresh } = useMokupScene(props.route)

const neighbors = computed(() => getRetailNeighbors(props.route))

const sectionRoutes = computed(() => {
  const group = routeMeta.value?.group
  if (!group) {
    return RETAIL_ROUTES.slice(0, 6)
  }
  return RETAIL_ROUTES.filter(item => item.group === group).slice(0, 6)
})

function openRoute(path: string) {
  if (path === props.route) {
    return
  }
  const url = `/${path}`
  if (RETAIL_TAB_ROUTES.has(path)) {
    wx.switchTab({ url })
    return
  }
  wx.navigateTo({ url })
}
</script>

<template>
  <view class="min-h-screen bg-gradient-to-b from-[#f8fafc] via-[#eef2ff] to-[#e2e8f0] px-[28rpx] pb-[96rpx] pt-[24rpx]">
    <view class="rounded-[28rpx] bg-white p-[24rpx] shadow-[0_16rpx_40rpx_rgba(15,23,42,0.08)]">
      <view class="flex items-center justify-between gap-[16rpx]">
        <view>
          <text class="block text-[36rpx] font-semibold text-[#0f172a]">
            {{ routeMeta?.title || '零售页' }}
          </text>
          <text class="mt-[8rpx] block text-[22rpx] text-[#64748b]">
            {{ routeMeta?.group || '模块' }} · wevu + tailwindcss + tdesign + mokup
          </text>
        </view>
        <t-button theme="primary" variant="outline" size="small" @tap="refresh">
          刷新场景
        </t-button>
      </view>

      <view class="mt-[16rpx] flex flex-wrap gap-[8rpx]">
        <t-tag theme="primary" variant="light">
          {{ props.route }}
        </t-tag>
        <t-tag v-if="loading" theme="warning" variant="light">
          数据加载中
        </t-tag>
        <t-tag v-else theme="success" variant="light">
          页面可访问
        </t-tag>
      </view>

      <t-skeleton v-if="loading" class="mt-[20rpx]" :loading="true" row-col="4" />
      <view v-else class="mt-[20rpx] rounded-[20rpx] bg-[#f8fafc] p-[18rpx]">
        <text class="text-[24rpx] text-[#334155]">
          {{ scene?.summary }}
        </text>
        <view class="mt-[14rpx] grid grid-cols-2 gap-[12rpx]">
          <view v-for="kpi in scene?.kpis || []" :key="kpi.label" class="rounded-[16rpx] bg-white p-[12rpx]">
            <text class="block text-[20rpx] text-[#64748b]">
              {{ kpi.label }}
            </text>
            <text class="mt-[6rpx] block text-[30rpx] font-semibold text-[#0f172a]">
              {{ kpi.value }}
            </text>
          </view>
        </view>
      </view>
    </view>

    <view class="mt-[20rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_12rpx_32rpx_rgba(15,23,42,0.06)]">
      <view class="mb-[10rpx] flex items-center justify-between">
        <text class="text-[28rpx] font-semibold text-[#0f172a]">
          同模块页面
        </text>
        <text class="text-[20rpx] text-[#94a3b8]">
          点击跳转
        </text>
      </view>
      <view class="grid grid-cols-2 gap-[10rpx]">
        <t-button
          v-for="item in sectionRoutes"
          :key="item.path"
          block
          variant="outline"
          size="small"
          :theme="item.path === props.route ? 'warning' : 'default'"
          @tap="openRoute(item.path)"
        >
          {{ item.title }}
        </t-button>
      </view>
    </view>

    <view class="mt-[20rpx] grid grid-cols-2 gap-[12rpx]">
      <t-button theme="default" variant="outline" block @tap="openRoute(neighbors.previous.path)">
        上一页 · {{ neighbors.previous.title }}
      </t-button>
      <t-button theme="primary" block @tap="openRoute(neighbors.next.path)">
        下一页 · {{ neighbors.next.title }}
      </t-button>
    </view>
  </view>
</template>
