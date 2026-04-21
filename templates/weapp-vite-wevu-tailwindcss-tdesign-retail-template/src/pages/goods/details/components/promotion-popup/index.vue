<script setup lang="ts">
defineOptions({
  options: {
    multipleSlots: true,
  },
})

withDefaults(defineProps<{
  list?: any[]
  title?: string
  show?: boolean
}>(), {
  list: () => [],
  title: '促销说明',
  show: false,
})

const emit = defineEmits<{
  promotionChange: [detail: { index: number }]
  closePromotionPopup: [detail: { show: boolean }]
}>()

function change(e: any) {
  const index = Number(e?.currentTarget?.dataset?.index || 0)
  emit('promotionChange', { index })
}

function closePromotionPopup() {
  emit('closePromotionPopup', { show: false })
}

defineExpose({
  change,
  closePromotionPopup,
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-popup': 'tdesign-miniprogram/popup/popup',
    't-icon': 'tdesign-miniprogram/icon/icon',
  },
})
</script>

<template>
  <t-popup :visible="show" placement="bottom" @visible-change="closePromotionPopup">
    <view class="promotion-popup-container bg-[#ffffff] relative z-100 rounded-[16rpx_16rpx_0_0] [&_.promotion-popup-close]:absolute [&_.promotion-popup-close]:right-[30rpx] [&_.promotion-popup-close]:top-[30rpx] [&_.promotion-popup-close]:z-9 [&_.promotion-popup-close]:text-[rgba(153,153,153,1)] [&_.promotion-popup-close_.market]:text-[25rpx] [&_.promotion-popup-close_.market]:text-[#999] [&_.promotion-popup-title]:h-[100rpx] [&_.promotion-popup-title]:relative [&_.promotion-popup-title]:flex [&_.promotion-popup-title]:items-center [&_.promotion-popup-title]:justify-center [&_.promotion-popup-title]:text-[32rpx] [&_.promotion-popup-title]:text-[#222427] [&_.promotion-popup-title]:font-semibold [&_.promotion-popup-content]:min-h-[400rpx] [&_.promotion-popup-content]:max-h-[600rpx] [&_.promotion-popup-content]:pb-[calc(env(safe-area-inset-bottom)+20rpx)] [&_.promotion-popup-content]:overflow-y-scroll [&_.promotion-popup-content]:[-webkit-overflow-scrolling:touch] [&_.promotion-popup-content_.promotion-detail-list]:m-[0_30rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item:last-child]:mb-[env(safe-area-inset-bottom)] [&_.promotion-popup-content_.promotion-detail-list_.list-item:last-child]:[border-bottom:0] [&_.promotion-popup-content_.promotion-detail-list_.list-item:last-child]:pb-[calc(28rpx+env(safe-area-inset-bottom))] [&_.promotion-popup-content_.promotion-detail-list_.list-item]:flex [&_.promotion-popup-content_.promotion-detail-list_.list-item]:justify-between [&_.promotion-popup-content_.promotion-detail-list_.list-item]:p-[10rpx_0_28rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item]:relative [&_.promotion-popup-content_.promotion-detail-list_.list-item]:text-[24rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item]:text-[#222427] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:box-border [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:text-[20rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:leading-[32rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:p-[2rpx_12rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:bg-[#ffece9] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:mr-[16rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:inline-flex [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:text-[#fa4126] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:rounded-[54rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:shrink-0 [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:relative [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:top-[2rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.content]:text-[28rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.content]:text-[#222427] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.content]:flex-1 [&_.promotion-popup-content_.promotion-detail-list_.list-item_.content]:leading-[40rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.content]:flex [&_.promotion-popup-content_.promotion-detail-list_.list-item_.content_.list-content]:w-[440rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.content_.list-content]:truncate [&_.promotion-popup-content_.promotion-detail-list_.list-item_.content_.list-content]:inline-block [&_.promotion-popup-content_.promotion-detail-list_.list-item_.collect-btn]:text-[24rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.collect-btn]:shrink-0 [&_.promotion-popup-content_.promotion-detail-list_.list-item_.collect-btn]:ml-[20rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.collect-btn]:flex [&_.promotion-popup-content_.promotion-detail-list_.list-item_.collect-btn]:items-center [&_.promotion-popup-content_.promotion-detail-list_.list-item_.collect-btn_.linkText]:mr-[8rpx]">
      <view class="promotion-popup-close" @tap="closePromotionPopup">
        <t-icon name="close" size="36rpx" />
      </view>
      <view class="promotion-popup-title">
        <view class="title">
          {{ title }}
        </view>
      </view>
      <view class="promotion-popup-content">
        <view class="promotion-detail-list">
          <view
            v-for="(item, index) in list"
            :key="index"
            class="list-item"
            :data-index="index"
            @tap="change"
          >
            <view class="tag">
              {{ item.tag }}
            </view>
            <view class="content">
              <text class="list-content">
                {{ item.label ? item.label : '' }}
              </text>
            </view>
            <t-icon
              class="collect-btn"
              name="chevron-right"
              size="40rpx"
              color="#bbb"
            />
          </view>
        </view>
      </view>
      <slot name="promotion-bottom" />
    </view>
  </t-popup>
</template>
