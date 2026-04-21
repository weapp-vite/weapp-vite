<script setup lang="ts">
import { computed, toRefs } from 'wevu'
import { getBigValues, isBigValue } from './tools'

defineOptions({
  setupLifecycle: 'created',
  options: {
    addGlobalClass: true,
    multipleSlots: true,
  },
  externalClasses: ['coupon-class'],
})

const props = withDefaults(defineProps<{
  mask?: boolean
  superposable?: boolean
  type?: string | number
  value?: string | number
  tag?: string
  desc?: string
  title?: string
  timeLimit?: string
  ruleDesc?: string
  currency?: string
  status?: string
  image?: string
}>(), {
  mask: false,
  superposable: false,
  type: '',
  value: '',
  tag: '',
  desc: '',
  title: '',
  timeLimit: '',
  ruleDesc: '',
  currency: '¥',
  status: 'default',
  image: '',
})

const CouponType = {
  MJ_COUPON: 1,
  ZK_COUPON: 2,
  MJF_COUPON: 3,
  MYF_COUPON: 3,
  GIFT_COUPON: 4,
  MERCHANT_MJ_COUPON: 1,
  MERCHANT_ZK_COUPON: 2,
} as const

const theme = computed(() => (props.status === 'useless' || props.status === 'disabled' ? 'weak' : 'primary'))

const {
  mask,
  superposable,
  type,
  value,
  tag,
  desc,
  title,
  timeLimit,
  ruleDesc,
  currency,
  status,
  image,
} = toRefs(props)

defineExpose({
  CouponType,
  theme,
  mask,
  superposable,
  type,
  value,
  tag,
  desc,
  title,
  timeLimit,
  ruleDesc,
  currency,
  status,
  image,
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-image': '/components/webp-image/index',
  },
})
</script>

<template>
  <view :class="`wr-coupon coupon-class theme-${theme} flex bg-[url(https://tdesign.gtimg.com/miniprogram/template/retail/coupon/coupon-bg-nocorners.png)] bg-size-[100%_100%] bg-no-repeat relative mb-[24rpx] overflow-hidden [background-image:url('https://tdesign.gtimg.com/miniprogram/template/retail/coupon/coupon-bg-nocorners.png')]`">
    <view class="wr-coupon__left w-[200rpx] h-[180rpx] flex flex-col justify-center text-center text-[#fa4126] overflow-hidden relative">
      <view v-if="type == CouponType.ZK_COUPON || type === CouponType.MERCHANT_ZK_COUPON">
        <text class="wr-coupon__left--value text-[64rpx] leading-[88rpx] [font-weight:bold] font-[\'DIN_Alternate\',cursive] [font-family:'DIN_Alternate',_cursive]">
          {{ value }}
        </text>
        <text class="wr-coupon__left--unit text-[24rpx] leading-[32rpx]">
          折
        </text>
        <view class="wr-coupon__left--desc text-[24rpx] leading-[32rpx] text-[#fa4126]">
          {{ desc }}
        </view>
      </view>
      <view v-if="type == CouponType.MJ_COUPON || type === CouponType.MERCHANT_MJ_COUPON">
        <text v-if="isBigValue(value)" class="wr-coupon__left--value text-[64rpx] leading-[88rpx] [font-weight:bold] font-[\'DIN_Alternate\',cursive] [font-family:'DIN_Alternate',_cursive]">
          <text class="wr-coupon__left--value-int text-[48rpx] leading-[88rpx]">
            {{ getBigValues(value)[0] }}
          </text>
          <text class="wr-coupon__left--value-decimal text-[36rpx] leading-[48rpx]">
            .{{ getBigValues(value)[1] }}
          </text>
        </text>
        <text v-else class="wr-coupon__left--value text-[64rpx] leading-[88rpx] [font-weight:bold] font-[\'DIN_Alternate\',cursive] [font-family:'DIN_Alternate',_cursive]">
          {{ Number(value) / 100 }}
        </text>
        <text class="wr-coupon__left--unit text-[24rpx] leading-[32rpx]">
          元
        </text>
        <view class="wr-coupon__left--desc text-[24rpx] leading-[32rpx] text-[#fa4126]">
          {{ desc }}
        </view>
      </view>
      <view v-if="type === CouponType.MJF_COUPON || type === CouponType.MYF_COUPON">
        <text class="wr-coupon__left--value text-[64rpx] leading-[88rpx] [font-weight:bold] font-[\'DIN_Alternate\',cursive] [font-family:'DIN_Alternate',_cursive]" style="font-family: 'PingFang SC', sans-serif; font-size: 44rpx">
          免邮
        </text>
        <view class="wr-coupon__left--desc text-[24rpx] leading-[32rpx] text-[#fa4126]">
          {{ desc }}
        </view>
      </view>
      <view v-if="type == CouponType.GIFT_COUPON">
        <t-image t-class="wr-coupon__left--image [width:128rpx] [height:128rpx] [border-radius:8px] [margin-top:30rpx]" :src="image" mode="aspectFill" />
      </view>
    </view>
    <view class="wr-coupon__right grow p-[0_20rpx] h-[180rpx] box-border overflow-hidden flex items-center">
      <view class="wr-coupon__right--title flex [-webkit-display:flex] flex-col items-start text-[#999999] text-[24rpx] flex-1 [&_.coupon-title]:max-w-[320rpx] [&_.coupon-title]:text-[#333333] [&_.coupon-title]:text-[28rpx] [&_.coupon-title]:leading-[40rpx] [&_.coupon-title]:[font-weight:bold] [&_.coupon-title]:line-clamp-1 [&_.coupon-title]:whitespace-normal [&_.coupon-time]:mt-[16rpx] [&_.coupon-desc]:mt-[8rpx] [&_.coupon-arrow]:text-[22rpx]">
        <text class="coupon-title">
          {{ title }}
        </text>
        <view class="coupon-time">
          {{ timeLimit }}
        </view>
        <view class="coupon-desc">
          <view v-if="ruleDesc">
            {{ ruleDesc }}
          </view>
        </view>
      </view>
      <view class="wr-coupon__right--oper flex justify-center items-center">
        <slot name="operator" />
      </view>
    </view>
    <view v-if="status === 'useless' || status === 'disabled'" :class="`wr-coupon__seal seal-${status} size-[128rpx] absolute top-0 right-0 bg-size-[100%_100%] [&_.seal-useless]:bg-[url('https://tdesign.gtimg.com/miniprogram/template/retail/coupon/seal-used.png')] [&_.seal-disabled]:bg-[url('https://tdesign.gtimg.com/miniprogram/template/retail/coupon/coupon-expired.png')]`" />
    <view v-if="mask" class="wr-coupon__mask w-[702rpx] h-[182rpx] absolute top-0 left-0 bg-[#ffffff] opacity-[0.5]" />
    <view v-if="superposable" class="wr-coupon__tag absolute top-[8px] right-[-24rpx] text-center w-[106rpx] h-[28rpx] opacity-[0.9] text-[20rpx] leading-[28rpx] text-[#fa4126] [border:0.5px_solid_#fa4126] box-border transform-[rotate(45deg)]">
      可叠加
    </view>
  </view>
</template>
