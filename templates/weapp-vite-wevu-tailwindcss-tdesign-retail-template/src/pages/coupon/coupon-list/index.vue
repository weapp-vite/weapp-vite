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
    't-empty': 'tdesign-miniprogram/empty/empty',
    'coupon-card': '../components/coupon-card/index',
  },
})
</script>

<template>
  <view class="coupon-page min-h-[100vh] bg-[#f5f5f5] pb-[calc(env(safe-area-inset-bottom)+120rpx)]">
    <t-tabs
      :value="status"
      :tabList="list"
      t-class="tabs-external__inner [height:88rpx] [width:100%] [line-height:88rpx] [z-index:10] [font-size:26rpx] [color:#333333] [background:#fff] [&_.tabs-external__track]:[background:#fa4126] [&_.tabs-external__item]:[color:#666] [&_.tabs-external__active]:[font-size:28rpx] [&_.tabs-external__active]:[color:#fa4126] [&_.order-nav_.order-nav-item_.bottom-line]:[bottom:12rpx]"
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
    <view
      class="coupon-list-wrap mt-[32rpx] mx-[32rpx] overflow-y-auto [-webkit-overflow-scrolling:touch] [&_.t-pull-down-refresh__bar]:[background:#fff]"
    >
      <t-pull-down-refresh
        id="t-pull-down-refresh"
        style="height: 100vh"
        t-class-indicator="t-class-indicator"
        background="#fff"
        @refresh="onPullDownRefresh_"
      >
        <view v-for="item in couponList" :key="item.key" class="coupon-list-item">
          <coupon-card :couponDTO="item" />
        </view>
        <view v-if="couponList.length === 0" class="empty-wrapper h-[calc(100vh-88rpx)]">
          <t-empty description="暂无可用优惠券" />
        </view>
      </t-pull-down-refresh>
      <view
        class="center-entry box-content bg-white h-[100rpx]"
        style="position: fixed; right: 0; bottom: 0; left: 0; z-index: 80; padding-bottom: 0; padding-bottom: constant(safe-area-inset-bottom); padding-bottom: env(safe-area-inset-bottom); border-top: 1rpx solid #dce0e4;"
      >
        <view class="center-entry-btn text-[#fa4126] text-[28rpx] text-center leading-[100rpx] flex items-center justify-center h-[100rpx]" @tap="goCouponCenterHandle">
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
  </view>
</template>
