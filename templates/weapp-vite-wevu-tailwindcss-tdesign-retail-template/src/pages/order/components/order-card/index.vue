<script setup lang="ts">
import { computed } from 'wevu'

interface OrderCardData {
  storeLogo?: string
  storeName?: string
  statusDesc?: string
  goodsList?: unknown[]
}

defineOptions({
  options: {
    multipleSlots: true,
  },
  externalClasses: ['wr-class', 'header-class', 'title-class'],
})

const props = withDefaults(defineProps<{
  order?: OrderCardData | null
  useTopRightSlot?: boolean
  defaultShowNum?: number
  useLogoSlot?: boolean
}>(), {
  order: () => ({}),
  useTopRightSlot: false,
  defaultShowNum: 10,
  useLogoSlot: false,
})

const emit = defineEmits<{
  cardtap: []
  showall: []
}>()

const goodsCount = computed(() => props.order?.goodsList?.length || 0)

function onOrderCardTap() {
  emit('cardtap')
}

function onShowMoreTap() {
  emit('showall')
}

defineComponentJson({
  component: true,
  usingComponents: {
    't-image': '/components/webp-image/index',
    't-icon': 'tdesign-miniprogram/icon/icon',
  },
})
</script>

<template>
  <view class="order-card wr-class [margin:24rpx_0] [padding:24rpx_32rpx_24rpx] [background-color:white] [border-radius:8rpx] [&_.header]:[display:flex] [&_.header]:[justify-content:space-between] [&_.header]:[align-items:center] [&_.header]:[margin-bottom:24rpx] [&_.header_.store-name]:[font-size:28rpx] [&_.header_.store-name]:[font-weight:normal] [&_.header_.store-name]:[color:#333333] [&_.header_.store-name]:[display:flex] [&_.header_.store-name]:[align-items:center] [&_.header_.store-name]:[line-height:40rpx] [&_.header_.store-name__logo]:[margin-right:16rpx] [&_.header_.store-name__logo]:[font-size:40rpx] [&_.header_.store-name__logo]:[width:48rpx] [&_.header_.store-name__logo]:[height:48rpx] [&_.header_.store-name__label]:[max-width:500rpx] [&_.header_.store-name__label]:[overflow:hidden] [&_.header_.store-name__label]:[text-overflow:ellipsis] [&_.header_.store-name__label]:[word-break:break-all] [&_.header_.store-name__label]:[white-space:nowrap] [&_.header_.order-status]:[font-size:26rpx] [&_.header_.order-status]:[line-height:40rpx] [&_.header_.order-status]:[color:#fa4126] [&_.more-mask]:[padding:20rpx_0] [&_.more-mask]:[text-align:center] [&_.more-mask]:[background-color:white] [&_.more-mask]:[color:#fa4126] [&_.more-mask]:[font-size:24rpx]" @tap="onOrderCardTap">
    <view class="header header-class">
      <view class="store-name title-class">
        <block v-if="!useLogoSlot">
          <t-image v-if="order?.storeLogo" t-class="store-name__logo" :src="order.storeLogo" />
          <t-icon v-else prefix="wr" class="store-name__logo" name="store" size="40rpx" color="inherit" />
          <view class="store-name__label">
            {{ order?.storeName }}
          </view>
        </block>
        <slot v-else name="top-left" />
      </view>
      <view v-if="!useTopRightSlot" class="order-status">
        {{ order?.statusDesc }}
      </view>
      <slot v-else name="top-right" />
    </view>
    <view class="slot-wrapper">
      <slot />
    </view>
    <view v-if="false && goodsCount > defaultShowNum" class="more-mask" @tap.stop="onShowMoreTap">
      展开商品信息（共 {{ goodsCount }} 个）
      <t-icon name="chevron-down" size="32rpx" />
    </view>
    <slot name="more" />
  </view>
</template>
