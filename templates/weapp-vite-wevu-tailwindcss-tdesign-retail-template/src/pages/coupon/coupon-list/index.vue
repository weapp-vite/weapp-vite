<script setup lang="ts">
import type { Coupon, CouponCardStatus } from '../../../model/coupon'
import { onLoad, ref } from 'wevu'
import { showToast } from '@/hooks/useToast'
import { fetchCouponList } from '../../../services/coupon/index'

const status = ref(0)
const list = ref([
  {
    text: '可使用',
    key: 0,
  },
  {
    text: '已使用',
    key: 1,
  },
  {
    text: '已失效',
    key: 2,
  },
])
const couponList = ref<Coupon[]>([])

function init() {
  void fetchList()
}

function fetchList(fetchStatus = status.value) {
  let statusInFetch: CouponCardStatus = 'default'
  switch (Number(fetchStatus)) {
    case 0:
      statusInFetch = 'default'
      break
    case 1:
      statusInFetch = 'useless'
      break
    case 2:
      statusInFetch = 'disabled'
      break
    default:
      throw new Error(`unknown fetchStatus: ${statusInFetch}`)
  }
  fetchCouponList(statusInFetch).then((nextCouponList) => {
    couponList.value = Array.isArray(nextCouponList) ? nextCouponList : []
  })
}

function tabChange(e: any) {
  const value = Number(e?.detail?.value)
  status.value = value
  fetchList(value)
}

function goCouponCenterHandle() {
  showToast({
    title: '去领券中心',
    icon: 'none',
  })
}

function onPullDownRefresh_() {
  couponList.value = []
  fetchList()
}

onLoad(() => {
  init()
})

defineExpose({
  status,
  list,
  couponList,
  tabChange,
  goCouponCenterHandle,
  onPullDownRefresh_,
})

definePageJson({
  navigationBarTitleText: '优惠券',
  usingComponents: {
    't-pull-down-refresh': 'tdesign-miniprogram/pull-down-refresh/pull-down-refresh',
    't-tabs': 'tdesign-miniprogram/tabs/tabs',
    't-tab-panel': 'tdesign-miniprogram/tab-panel/tab-panel',
    't-icon': 'tdesign-miniprogram/icon/icon',
    'coupon-card': '../components/coupon-card/index',
  },
})
</script>

<template>
  <t-tabs
    :defaultValue="status"
    :tabList="list"
    t-class="tabs-external__inner [height:88rpx] [width:100%] [line-height:88rpx] [z-index:100] [font-size:26rpx] [color:#333333] [position:fixed] [width:100vw] [top:0] [left:0] [&_.tabs-external__track]:[background:#fa4126] [&_.tabs-external__item]:[color:#666] [&_.tabs-external__active]:[font-size:28rpx] [&_.tabs-external__active]:[color:#fa4126] [&_.order-nav_.order-nav-item_.bottom-line]:[bottom:12rpx]"
    t-class-item="tabs-external__item"
    t-class-active="tabs-external__active"
    t-class-track="tabs-external__track"
    @change="tabChange"
  >
    <t-tab-panel
      v-for="tab in list"
      :key="tab.key"
      :label="tab.text || ''"
      :value="tab.key"
    />
  </t-tabs>
  <view class="coupon-list-wrap [margin-top:32rpx] [margin-left:32rpx] [margin-right:32rpx] [overflow-y:auto] [padding-bottom:100rpx] [padding-bottom:calc(constant(safe-area-inset-top)_+_100rpx)] [padding-bottom:calc(env(safe-area-inset-bottom)_+_100rpx)] [-webkit-overflow-scrolling:touch] [&_.t-pull-down-refresh__bar]:[background:#fff]">
    <t-pull-down-refresh
      id="t-pull-down-refresh"
      t-class-indicator="t-class-indicator"
      background="#fff"
      @refresh="onPullDownRefresh_"
    >
      <view v-for="item in couponList" :key="item.key" class="coupon-list-item">
        <coupon-card :couponDTO="item" />
      </view>
    </t-pull-down-refresh>
    <view class="center-entry [box-sizing:content-box] [border-top:1rpx_solid_#dce0e4] [background-color:#fff] [position:fixed] [bottom:0] [left:0] [right:0] [height:100rpx] [padding-bottom:0] [padding-bottom:constant(safe-area-inset-top)] [padding-bottom:env(safe-area-inset-bottom)]">
      <view class="center-entry-btn [color:#fa4126] [font-size:28rpx] [text-align:center] [line-height:100rpx] [display:flex] [align-items:center] [justify-content:center] [height:100rpx]" @tap="goCouponCenterHandle">
        <view>领券中心</view>
        <t-icon
          name="chevron-right"
          color="#fa4126"
          size="40rpx"
          style="line-height: 28rpx;"
        />
      </view>
    </view>
  </view>
</template>
