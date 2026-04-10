<script setup lang="ts">
import type { Coupon, CouponCardStatus } from '../../../../model/coupon'
import { computed } from 'wevu'
import { wpi } from 'wevu/api'

defineOptions({
  options: {
    addGlobalClass: true,
    multipleSlots: true, // 在组件定义时的选项中启用多slot支持
  },
  externalClasses: ['coupon-class'],
} as any)

const props = withDefaults(defineProps<{
  couponDTO?: Coupon | null
}>(), {
  couponDTO: null,
})

const statusMap: Record<CouponCardStatus, { text: string, theme: string }> = {
  default: {
    text: '去使用',
    theme: 'primary',
  },
  useless: {
    text: '已使用',
    theme: 'default',
  },
  disabled: {
    text: '已过期',
    theme: 'default',
  },
}

const btnStatus = computed(() => statusMap[props.couponDTO?.status ?? 'default'])
const btnText = computed(() => btnStatus.value.text)
const btnTheme = computed(() => btnStatus.value.theme)

async function gotoDetail() {
  const couponKey = props.couponDTO?.key
  if (!couponKey) {
    return
  }
  await wpi.navigateTo({
    url: `/pages/coupon/coupon-detail/index?id=${couponKey}`,
  })
}

async function gotoGoodsList() {
  const couponKey = props.couponDTO?.key
  if (!couponKey) {
    return
  }
  await wpi.navigateTo({
    url: `/pages/coupon/coupon-activity-goods/index?id=${couponKey}`,
  })
}

defineComponentJson({
  component: true,
  usingComponents: {
    'ui-coupon-card': '/components/promotion/ui-coupon-card/index',
    't-button': 'tdesign-miniprogram/button/button',
  },
})
</script>

<template>
  <ui-coupon-card
    :title="couponDTO?.title || ''"
    :type="couponDTO?.type || ''"
    :value="couponDTO?.value || '0'"
    :tag="couponDTO?.tag || ''"
    :desc="couponDTO?.desc || ''"
    :currency="couponDTO?.currency || ''"
    :timeLimit="couponDTO?.timeLimit || ''"
    :status="couponDTO?.status || ''"
    @tap="gotoDetail"
  >
    <template #operator>
      <view class="coupon-btn-slot">
        <t-button
          :t-class="`coupon-btn-${btnTheme}`"
          :theme="btnTheme"
          variant="outline"
          shape="round"
          size="extra-small"
          @tap="gotoGoodsList"
        >
          {{ btnText }}
        </t-button>
      </view>
    </template>
  </ui-coupon-card>
</template>
