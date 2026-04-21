<script setup lang="ts">
defineOptions({
  externalClasses: ['wr-class'],
})

withDefaults(defineProps<{
  addressData?: Record<string, any>
}>(), {
  addressData: () => ({}),
})

const emit = defineEmits<{
  addressclick: []
  addclick: []
}>()

function hidePhoneNum(value?: string) {
  if (!value) {
    return ''
  }
  return `${value.substring(0, 3)}****${value.substring(7)}`
}

function onAddressTap() {
  emit('addressclick')
}

function onAddTap() {
  emit('addclick')
}

defineExpose({
  onAddressTap,
  onAddTap,
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-cell': 'tdesign-miniprogram/cell/cell',
    't-icon': 'tdesign-miniprogram/icon/icon',
  },
})
</script>

<template>
  <view class="address-card wr-class [background:#fff] m-[0rpx_0rpx_24rpx] [&_.wr-cell__title]:text-[#999] [&_.wr-cell__title]:ml-[6rpx] [&_.order-address]:flex [&_.order-address]:w-full [&_.order-address_.address-content]:flex-1 [&_.order-address_.title]:flex [&_.order-address_.title]:items-center [&_.order-address_.title]:h-[40rpx] [&_.order-address_.title]:text-[28rpx] [&_.order-address_.title]:[font-weight:normal] [&_.order-address_.title]:text-[#999999] [&_.order-address_.title]:leading-[40rpx] [&_.order-address_.title_.address-tag]:w-[52rpx] [&_.order-address_.title_.address-tag]:h-[29rpx] [&_.order-address_.title_.address-tag]:[border:1rpx_solid_#0091ff] [&_.order-address_.title_.address-tag]:bg-[rgba(122,167,251,0.1)] [&_.order-address_.title_.address-tag]:text-center [&_.order-address_.title_.address-tag]:leading-[29rpx] [&_.order-address_.title_.address-tag]:rounded-[8rpx] [&_.order-address_.title_.address-tag]:text-[#0091ff] [&_.order-address_.title_.address-tag]:text-[20rpx] [&_.order-address_.title_.address-tag]:mr-[12rpx] [&_.order-address_.detail]:line-clamp-2 [&_.order-address_.detail]:text-ellipsis [&_.order-address_.detail]:text-[36rpx] [&_.order-address_.detail]:[font-weight:bold] [&_.order-address_.detail]:text-[#333333] [&_.order-address_.detail]:leading-[48rpx] [&_.order-address_.detail]:m-[8rpx_0] [&_.order-address_.info]:h-[40rpx] [&_.order-address_.info]:text-[28rpx] [&_.order-address_.info]:[font-weight:normal] [&_.order-address_.info]:text-[#333333] [&_.order-address_.info]:leading-[40rpx] [&_.top-line]:w-full [&_.top-line]:h-[6rpx] [&_.top-line]:bg-white [&_.top-line]:bg-[url(https://tdesign.gtimg.com/miniprogram/template/retail/order/stripe.png)] [&_.top-line]:bg-repeat-x [&_.top-line]:block">
    <t-cell v-if="addressData && addressData.detailAddress" hover @tap="onAddressTap">
      <template #title>
        <view class="order-address [&_.address__right]:self-center">
          <t-icon name="location" color="#333333" size="40rpx" />
          <view class="address-content">
            <view class="title">
              <view v-if="addressData.addressTag" class="address-tag">
                {{ addressData.addressTag }}
              </view>
              {{ addressData.provinceName }} {{ addressData.cityName }} {{ addressData.districtName }}
            </view>
            <view class="detail">
              {{ addressData.detailAddress }}
            </view>
            <view class="info">
              {{ addressData.name }} {{ hidePhoneNum(addressData.phone) }}
            </view>
          </view>
          <t-icon
            class="address__right"
            name="chevron-right"
            color="#BBBBBB"
            size="40rpx"
          />
        </view>
      </template>
    </t-cell>
    <t-cell
      v-else
      title="添加收货地址"
      hover
      @tap="onAddTap"
    >
      <template #left-icon>
        <t-icon name="add-circle"size="40rpx" />
      </template>
    </t-cell>
    <view class="top-line" />
  </view>
</template>
