<script setup lang="ts">
import { computed, toRefs } from 'wevu'

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
  type?: string
  value?: string
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
  GIFT_COUPON: 4,
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
</script>

<template>
  <wxs src="./tools.wxs" module="tools" />
  <view class="wr-coupon coupon-class theme-{{theme}} [display:flex] [background-image:url(https://tdesign.gtimg.com/miniprogram/template/retail/coupon/coupon-bg-nocorners.png)] [background-size:100%_100%] [background-repeat:no-repeat] [position:relative] [margin-bottom:24rpx] [overflow:hidden] [background-image:url('https://tdesign.gtimg.com/miniprogram/template/retail/coupon/coupon-bg-nocorners.png')]">
    <view class="wr-coupon__left [width:200rpx] [height:180rpx] [display:flex] [flex-direction:column] [justify-content:center] [text-align:center] [color:#fa4126] [overflow:hidden] [position:relative]">
      <view wx:if="{{type == CouponType.ZK_COUPON || type === CouponType.MERCHANT_ZK_COUPON}}">
        <text class="wr-coupon__left--value [font-size:64rpx] [line-height:88rpx] [font-weight:bold] [font-family:\'DIN_Alternate\',_cursive] [font-family:'DIN_Alternate',_cursive]">
          {{ value }}
        </text>
        <text class="wr-coupon__left--unit [font-size:24rpx] [line-height:32rpx]">
          折
        </text>
        <view class="wr-coupon__left--desc [font-size:24rpx] [line-height:32rpx] [color:#fa4126]">
          {{ desc }}
        </view>
      </view>
      <view wx:if="{{type == CouponType.MJ_COUPON || type === CouponType.MERCHANT_MJ_COUPON}}">
        <text class="wr-coupon__left--value [font-size:64rpx] [line-height:88rpx] [font-weight:bold] [font-family:\'DIN_Alternate\',_cursive] [font-family:'DIN_Alternate',_cursive]" wx:if="{{tools.isBigValue(value)}}">
          <text class="wr-coupon__left--value-int [font-size:48rpx] [line-height:88rpx]">
            {{ tools.getBigValues(value)[0] }}
          </text>
          <text class="wr-coupon__left--value-decimal [font-size:36rpx] [line-height:48rpx]">
            .{{ tools.getBigValues(value)[1] }}
          </text>
        </text>
        <text class="wr-coupon__left--value [font-size:64rpx] [line-height:88rpx] [font-weight:bold] [font-family:\'DIN_Alternate\',_cursive] [font-family:'DIN_Alternate',_cursive]" wx:else>
          {{ value / 100 }}
        </text>
        <text class="wr-coupon__left--unit [font-size:24rpx] [line-height:32rpx]">
          元
        </text>
        <view class="wr-coupon__left--desc [font-size:24rpx] [line-height:32rpx] [color:#fa4126]">
          {{ desc }}
        </view>
      </view>
      <view wx:if="{{type === CouponType.MJF_COUPON || type === CouponType.MYF_COUPON}}">
        <text class="wr-coupon__left--value [font-size:64rpx] [line-height:88rpx] [font-weight:bold] [font-family:\'DIN_Alternate\',_cursive] [font-family:'DIN_Alternate',_cursive]" style="font-family: 'PingFang SC', sans-serif; font-size: 44rpx">
          免邮
        </text>
        <view class="wr-coupon__left--desc [font-size:24rpx] [line-height:32rpx] [color:#fa4126]">
          {{ desc }}
        </view>
      </view>
      <view wx:if="{{type == CouponType.GIFT_COUPON}}">
        <t-image t-class="wr-coupon__left--image [width:128rpx] [height:128rpx] [border-radius:8px] [margin-top:30rpx]" src="{{image}}" mode="aspectFill" />
      </view>
    </view>
    <view class="wr-coupon__right [flex-grow:1] [padding:0_20rpx] [height:180rpx] [box-sizing:border-box] [overflow:hidden] [display:flex] [align-items:center]">
      <view class="wr-coupon__right--title [display:flex] [-webkit-display:flex] [flex-direction:column] [align-items:flex-start] [color:#999999] [font-size:24rpx] [flex:1] [&_.coupon-title]:[max-width:320rpx] [&_.coupon-title]:[color:#333333] [&_.coupon-title]:[font-size:28rpx] [&_.coupon-title]:[line-height:40rpx] [&_.coupon-title]:[font-weight:bold] [&_.coupon-title]:[display:-webkit-box] [&_.coupon-title]:[-webkit-line-clamp:1] [&_.coupon-title]:[-webkit-box-orient:vertical] [&_.coupon-title]:[overflow:hidden] [&_.coupon-title]:[white-space:normal] [&_.coupon-time]:[margin-top:16rpx] [&_.coupon-desc]:[margin-top:8rpx] [&_.coupon-arrow]:[font-size:22rpx]">
        <text class="coupon-title">
          {{ title }}
        </text>
        <view class="coupon-time">
          {{ timeLimit }}
        </view>
        <view class="coupon-desc">
          <view wx:if="{{ruleDesc}}">
            {{ ruleDesc }}
          </view>
        </view>
      </view>
      <view class="wr-coupon__right--oper [display:flex] [justify-content:center] [align-items:center]">
        <slot name="operator" />
      </view>
    </view>
    <view wx:if="{{status === 'useless' || status === 'disabled'}}" class="wr-coupon__seal seal-{{status}} [width:128rpx] [height:128rpx] [position:absolute] [top:0] [right:0] [background-size:100%_100%] [&_.seal-useless]:[background-image:url('https://tdesign.gtimg.com/miniprogram/template/retail/coupon/seal-used.png')] [&_.seal-disabled]:[background-image:url('https://tdesign.gtimg.com/miniprogram/template/retail/coupon/coupon-expired.png')]" />
    <view wx:if="{{mask}}" class="wr-coupon__mask [width:702rpx] [height:182rpx] [position:absolute] [top:0] [left:0] [background-color:#ffffff] [opacity:0.5]" />
    <view wx:if="{{superposable}}" class="wr-coupon__tag [position:absolute] [top:8px] [right:-24rpx] [text-align:center] [width:106rpx] [height:28rpx] [opacity:0.9] [font-size:20rpx] [line-height:28rpx] [color:#fa4126] [border:0.5px_solid_#fa4126] [box-sizing:border-box] [transform:rotate(45deg)]">
      可叠加
    </view>
  </view>
</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-image": "/components/webp-image/index"
  }
}
</json>
