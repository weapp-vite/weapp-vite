<script setup lang="ts">
defineOptions({
  externalClasses: ['title-class', 'icon-class', 'number-class'],
  options: {
    multipleSlots: true,
  },
})

withDefaults(defineProps<{
  orderTagInfos?: Array<Record<string, any>>
  title?: string
  desc?: string
  isTop?: boolean
  classPrefix?: string
}>(), {
  orderTagInfos: () => [],
  title: '我的订单',
  desc: '全部订单',
  isTop: true,
  classPrefix: 'wr',
})

const emit = defineEmits<{
  onClickItem: [detail: any]
  onClickTop: [detail: Record<string, never>]
}>()

function onClickItem(e: any) {
  emit('onClickItem', e?.currentTarget?.dataset?.item)
}

function onClickTop() {
  emit('onClickTop', {})
}

defineExpose({
  onClickItem,
  onClickTop,
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-cell': 'tdesign-miniprogram/cell/cell',
    't-cell-group': 'tdesign-miniprogram/cell-group/cell-group',
    't-badge': 'tdesign-miniprogram/badge/badge',
    't-icon': 'tdesign-miniprogram/icon/icon',
  },
})
</script>

<template>
  <view class="order-group mb-[24rpx] bg-[#ffffff] rounded-[16rpx_16rpx_0_0] [&_.order-group__top]:p-[24rpx_18rpx_24rpx_32rpx] [&_.order-group__top]:rounded-[16rpx_16rpx_0_0] [&_.order-group__left]:mr-0">
    <t-cell-group v-if="isTop">
      <t-cell
        t-class="order-group__top"
        t-class-left="order-group__left"
        t-class-title="order-group__top__title"
        t-class-note="order-group__top__note"
        :title="title"
        :note="desc"
        :bordered="false"
        arrow
        @tap="onClickTop"
      />
    </t-cell-group>
    <view class="order-group__content overflow-hidden w-full h-[164rpx] flex bg-white rounded-[0_0_16rpx_16rpx]">
      <view
        v-for="(item, index) in orderTagInfos"
        :key="index"
        class="order-group__item overflow-hidden flex flex-col items-center justify-center flex-1 first:rounded-[0_0_0_16rpx] last:rounded-[0_0_16rpx_0]"
        :data-item="item"
        @tap="onClickItem"
      >
        <view class="order-group__item__icon icon-class mb-[20rpx] size-[56rpx] relative">
          <t-badge :count="item.orderNum" :max-count="99" color="#FF4646">
            <t-icon
              :prefix="classPrefix"
              :name="item.iconName"
              size="56rpx"
              customStyle="background-image: -webkit-linear-gradient(90deg, #6a6a6a 0%,#929292 100%);-webkit-background-clip: text;-webkit-text-fill-color: transparent;"
            />
          </t-badge>
        </view>
        <view class="order-group__item__title title-class text-[24rpx] text-[#666] leading-[32rpx]">
          {{ item.title }}
        </view>
      </view>
    </view>
  </view>
</template>
