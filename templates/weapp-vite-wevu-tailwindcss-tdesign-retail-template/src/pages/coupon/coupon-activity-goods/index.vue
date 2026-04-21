<script setup lang="ts">
import { onLoad, ref, useNativeInstance } from 'wevu'
import { wpi } from 'wevu/api'
import { showToast } from '@/hooks/useToast'
import { fetchCouponDetail } from '../../../services/coupon/index'
import { fetchGoodsList } from '../../../services/good/fetchGoods'

const nativeInstance = useNativeInstance()

const id = ref(0)
const goods = ref<any[]>([])
const detail = ref<Record<string, any>>({})
const couponTypeDesc = ref('')
const showStoreInfoList = ref(false)
const cartNum = ref(2)

function getCouponDetail(couponId: number) {
  fetchCouponDetail(couponId).then(({ detail: nextDetail }: { detail: Record<string, any> }) => {
    detail.value = nextDetail
    if (nextDetail.type === 2) {
      if (nextDetail.base > 0) {
        couponTypeDesc.value = `满${nextDetail.base / 100}元${nextDetail.value}折`
      }
      else {
        couponTypeDesc.value = `${nextDetail.value}折`
      }
    }
    else if (nextDetail.type === 1) {
      if (nextDetail.base > 0) {
        couponTypeDesc.value = `满${nextDetail.base / 100}元减${nextDetail.value / 100}元`
      }
      else {
        couponTypeDesc.value = `减${nextDetail.value / 100}元`
      }
    }
  })
}

function getGoodsList(couponId: number) {
  fetchGoodsList(couponId).then((nextGoods) => {
    goods.value = Array.isArray(nextGoods) ? nextGoods : []
  })
}

function openStoreList() {
  showStoreInfoList.value = true
}

function closeStoreList() {
  showStoreInfoList.value = false
}

async function goodClickHandle(e: any) {
  const index = Number(e?.detail?.index)
  if (!Number.isFinite(index) || index < 0) {
    return
  }
  const spuId = goods.value[index]?.spuId
  if (spuId == null) {
    return
  }
  await wpi.navigateTo({
    url: `/pages/goods/details/index?spuId=${spuId}`,
  })
}

function cartClickHandle() {
  showToast({
    context: nativeInstance,
    message: '点击加入购物车',
  })
}

onLoad((query: { id?: string }) => {
  const couponId = Number.parseInt(query.id || '0', 10)
  id.value = couponId
  getCouponDetail(couponId)
  getGoodsList(couponId)
})

defineExpose({
  goods,
  detail,
  couponTypeDesc,
  showStoreInfoList,
  cartNum,
  openStoreList,
  closeStoreList,
  goodClickHandle,
  cartClickHandle,
})

definePageJson({
  navigationBarTitleText: '活动商品',
  usingComponents: {
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-popup': 'tdesign-miniprogram/popup/popup',
    'goods-list': '/components/goods-list/index',
    'floating-button': '../components/floating-button/index',
  },
})
</script>

<template>
  <view class="coupon-page-container [&_.notice-bar-content]:flex [&_.notice-bar-content]:flex-row [&_.notice-bar-content]:items-center [&_.notice-bar-content]:p-[8rpx_0] [&_.notice-bar-text]:text-[26rpx] [&_.notice-bar-text]:leading-[36rpx] [&_.notice-bar-text]:font-normal [&_.notice-bar-text]:text-[#666666] [&_.notice-bar-text]:ml-[24rpx] [&_.notice-bar-text]:mr-[12rpx] [&_.notice-bar-text_.height-light]:text-[#fa550f] [&_.popup-content-wrap]:bg-white [&_.popup-content-wrap]:rounded-t-[20rpx] [&_.popup-content-title]:text-[32rpx] [&_.popup-content-title]:text-[#333] [&_.popup-content-title]:text-center [&_.popup-content-title]:h-[104rpx] [&_.popup-content-title]:leading-[104rpx] [&_.popup-content-title]:relative [&_.desc-group-wrap]:pb-[env(safe-area-inset-bottom)] [&_.desc-group-wrap_.item-wrap]:m-[0_30rpx_30rpx] [&_.desc-group-wrap_.item-title]:text-[26rpx] [&_.desc-group-wrap_.item-title]:text-[#333] [&_.desc-group-wrap_.item-title]:font-medium [&_.desc-group-wrap_.item-label]:text-[24rpx] [&_.desc-group-wrap_.item-label]:text-[#666] [&_.desc-group-wrap_.item-label]:mt-[12rpx] [&_.desc-group-wrap_.item-label]:whitespace-pre-line [&_.desc-group-wrap_.item-label]:break-all [&_.desc-group-wrap_.item-label]:leading-[34rpx] [&_.goods-list-container]:m-[0_24rpx_24rpx] [&_.goods-list-wrap]:[background:#f5f5f5]">
    <view class="notice-bar-content">
      <view class="notice-bar-text">
        以下商品可使用
        <text class="height-light">
          {{ couponTypeDesc }}
        </text>
        优惠券
      </view>
      <t-icon name="help-circle" size="32rpx" color="#AAAAAA" @tap="openStoreList" />
    </view>
    <view class="goods-list-container">
      <goods-list
        wr-class="goods-list-wrap"
        :goodsList="goods"
        @click="goodClickHandle"
        @addcart="cartClickHandle"
      />
    </view>
    <floating-button :count="cartNum" />
    <t-popup :visible="showStoreInfoList" placement="bottom" @visible-change="closeStoreList">
      <template #closeBtn>
        <t-icon name="close" size="40rpx" @tap="closeStoreList" />
      </template>
      <view class="popup-content-wrap">
        <view class="popup-content-title">
          规则详情
        </view>
        <view class="desc-group-wrap">
          <view v-if="detail && detail.timeLimit" class="item-wrap">
            <view class="item-title">
              优惠券有效时间
            </view>
            <view class="item-label">
              {{ detail.timeLimit }}
            </view>
          </view>
          <view v-if="detail && detail.desc" class="item-wrap">
            <view class="item-title">
              优惠券说明
            </view>
            <view class="item-label">
              {{ detail.desc }}
            </view>
          </view>
          <view v-if="detail && detail.useNotes" class="item-wrap">
            <view class="item-title">
              使用须知
            </view>
            <view class="item-label">
              {{ detail.useNotes }}
            </view>
          </view>
        </view>
      </view>
    </t-popup>
  </view>
</template>
