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
  <view class="order-card wr-class m-[24rpx_0] p-[24rpx_32rpx_24rpx] bg-[white] rounded-[8rpx] [&_.header]:flex [&_.header]:justify-between [&_.header]:items-center [&_.header]:mb-[24rpx] [&_.header_.store-name]:text-[28rpx] [&_.header_.store-name]:[font-weight:normal] [&_.header_.store-name]:text-[#333333] [&_.header_.store-name]:flex [&_.header_.store-name]:items-center [&_.header_.store-name]:leading-[40rpx] [&_.header_.store-name__logo]:mr-[16rpx] [&_.header_.store-name__logo]:text-[40rpx] [&_.header_.store-name__logo]:size-[48rpx] [&_.header_.store-name__label]:max-w-[500rpx] [&_.header_.store-name__label]:truncate [&_.header_.store-name__label]:break-all [&_.header_.order-status]:text-[26rpx] [&_.header_.order-status]:leading-[40rpx] [&_.header_.order-status]:text-[#fa4126] [&_.more-mask]:p-[20rpx_0] [&_.more-mask]:text-center [&_.more-mask]:bg-[white] [&_.more-mask]:text-[#fa4126] [&_.more-mask]:text-[24rpx]" @tap="onOrderCardTap">
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
