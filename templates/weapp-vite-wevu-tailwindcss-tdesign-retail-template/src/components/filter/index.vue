<script setup lang="ts">
import { toRefs } from 'wevu'

defineOptions({
  setupLifecycle: 'created',
  externalClasses: ['wr-class'],
  options: {
    multipleSlots: true,
  },
})

const props = withDefaults(defineProps<{
  overall?: number
  layout?: number
  sorts?: string
  color?: string
  prices?: unknown[]
}>(), {
  overall: 1,
  layout: 1,
  sorts: '',
  color: '#FA550F',
  prices: () => [],
})

const emit = defineEmits<{
  change: [payload: {
    overall: number
    layout: number
    sorts: string
    color: string
    prices: unknown[]
  }]
  showFilterPopup: [payload: { show: boolean }]
}>()

const { overall, layout, sorts, color, prices } = toRefs(props)

function onChangeShowAction() {
  const nextLayout = layout.value === 1 ? 0 : 1
  emit('change', {
    ...props,
    layout: nextLayout,
  })
}

function handlePriseSort() {
  emit('change', {
    ...props,
    overall: 0,
    sorts: sorts.value === 'desc' ? 'asc' : 'desc',
  })
}

function open() {
  emit('showFilterPopup', {
    show: true,
  })
}

function onOverallAction() {
  const nextOverall = overall.value === 1 ? 0 : 1
  emit('change', {
    ...props,
    sorts: '',
    prices: [],
    overall: nextOverall,
  })
}

defineExpose({
  overall,
  layout,
  sorts,
  color,
  prices,
  onChangeShowAction,
  handlePriseSort,
  open,
  onOverallAction,
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-icon': 'tdesign-miniprogram/icon/icon',
  },
})
</script>

<template>
  <!-- 过滤组件 -->
  <view class="wr-class filter-wrap w-full h-[88rpx] flex justify-between relative [background:#fff]">
    <view class="filter-left-content h-full flex grow-2 [flex-flow:row_nowrap] justify-between [&_.filter-item]:flex-1 [&_.filter-item]:h-full [&_.filter-item]:flex [&_.filter-item]:items-center [&_.filter-item]:justify-center [&_.filter-item]:text-[26rpx] [&_.filter-item]:leading-[36rpx] [&_.filter-item]:font-normal [&_.filter-item]:text-[rgba(51,51,51,1)] [&_.filter-item_.filter-price]:flex [&_.filter-item_.filter-price]:flex-col [&_.filter-item_.filter-price]:ml-[6rpx] [&_.filter-item_.filter-price]:justify-between [&_.filter-item_.wr-filter]:ml-[8rpx] [&_.filter-active-item]:text-[#fa550f]">
      <view :class="`filter-item ${overall === 1 ? 'filter-active-item' : ''}`" @tap="onOverallAction">
        综合
      </view>
      <view class="filter-item" @tap="handlePriseSort">
        <text :style="`color: ${sorts != '' ? color : ''}`">
          价格
        </text>
        <view class="filter-price">
          <t-icon
            prefix="wr"
            name="arrow_drop_up"
            size="18rpx"
            :style="`color: ${sorts == 'asc' ? color : '#bbb'}`"
          />
          <t-icon
            prefix="wr"
            name="arrow_drop_down"
            size="18rpx"
            :style="`color: ${sorts == 'desc' ? color : '#bbb'}`"
          />
        </view>
      </view>
      <view :class="`filter-item ${prices.length ? 'filter-active-item' : ''}`" data-index="5" @tap="open">
        筛选
        <t-icon
          name="filter"
          prefix="wr"
          color="#333"
          size="32rpx"
        />
      </view>
    </view>
  </view>
  <!-- 筛选弹框 -->
  <slot name="filterPopup" />
</template>
