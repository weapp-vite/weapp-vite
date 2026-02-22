<script setup lang="ts">
import { fetchCouponDetail } from '../../../services/coupon/index';
import { fetchGoodsList } from '../../../services/good/fetchGoods';
import { onLoad, ref, useNativeInstance } from 'wevu';
import Toast from 'tdesign-miniprogram/toast/index';

const nativeInstance = useNativeInstance() as any;

const id = ref(0);
const goods = ref<any[]>([]);
const detail = ref<Record<string, any>>({});
const couponTypeDesc = ref('');
const showStoreInfoList = ref(false);
const cartNum = ref(2);

function getCouponDetail(couponId: number) {
  fetchCouponDetail(couponId).then(({ detail: nextDetail }: { detail: Record<string, any> }) => {
    detail.value = nextDetail;
    if (nextDetail.type === 2) {
      if (nextDetail.base > 0) {
        couponTypeDesc.value = `满${nextDetail.base / 100}元${nextDetail.value}折`;
      }
      else {
        couponTypeDesc.value = `${nextDetail.value}折`;
      }
    }
    else if (nextDetail.type === 1) {
      if (nextDetail.base > 0) {
        couponTypeDesc.value = `满${nextDetail.base / 100}元减${nextDetail.value / 100}元`;
      }
      else {
        couponTypeDesc.value = `减${nextDetail.value / 100}元`;
      }
    }
  });
}

function getGoodsList(couponId: number) {
  fetchGoodsList(couponId).then((nextGoods) => {
    goods.value = Array.isArray(nextGoods) ? nextGoods : [];
  });
}

function openStoreList() {
  showStoreInfoList.value = true;
}

function closeStoreList() {
  showStoreInfoList.value = false;
}

function goodClickHandle(e: any) {
  const index = Number(e?.detail?.index);
  if (!Number.isFinite(index) || index < 0) {
    return;
  }
  const spuId = goods.value[index]?.spuId;
  if (spuId == null) {
    return;
  }
  wx.navigateTo({
    url: `/pages/goods/details/index?spuId=${spuId}`,
  });
}

function cartClickHandle() {
  Toast({
    context: nativeInstance,
    selector: '#t-toast',
    message: '点击加入购物车',
  });
}

onLoad((query: { id?: string }) => {
  const couponId = Number.parseInt(query.id || '0', 10);
  id.value = couponId;
  getCouponDetail(couponId);
  getGoodsList(couponId);
});

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
});
</script>

<template>
<view class="coupon-page-container [&_.notice-bar-content]:[display:flex] [&_.notice-bar-content]:[flex-direction:row] [&_.notice-bar-content]:[align-items:center] [&_.notice-bar-content]:[padding:8rpx_0] [&_.notice-bar-text]:[font-size:26rpx] [&_.notice-bar-text]:[line-height:36rpx] [&_.notice-bar-text]:[font-weight:400] [&_.notice-bar-text]:[color:#666666] [&_.notice-bar-text]:[margin-left:24rpx] [&_.notice-bar-text]:[margin-right:12rpx] [&_.notice-bar-text_.height-light]:[color:#fa550f] [&_.popup-content-wrap]:[background-color:#fff] [&_.popup-content-wrap]:[border-top-left-radius:20rpx] [&_.popup-content-wrap]:[border-top-right-radius:20rpx] [&_.popup-content-title]:[font-size:32rpx] [&_.popup-content-title]:[color:#333] [&_.popup-content-title]:[text-align:center] [&_.popup-content-title]:[height:104rpx] [&_.popup-content-title]:[line-height:104rpx] [&_.popup-content-title]:[position:relative] [&_.desc-group-wrap]:[padding-bottom:env(safe-area-inset-bottom)] [&_.desc-group-wrap_.item-wrap]:[margin:0_30rpx_30rpx] [&_.desc-group-wrap_.item-title]:[font-size:26rpx] [&_.desc-group-wrap_.item-title]:[color:#333] [&_.desc-group-wrap_.item-title]:[font-weight:500] [&_.desc-group-wrap_.item-label]:[font-size:24rpx] [&_.desc-group-wrap_.item-label]:[color:#666] [&_.desc-group-wrap_.item-label]:[margin-top:12rpx] [&_.desc-group-wrap_.item-label]:[white-space:pre-line] [&_.desc-group-wrap_.item-label]:[word-break:break-all] [&_.desc-group-wrap_.item-label]:[line-height:34rpx] [&_.goods-list-container]:[margin:0_24rpx_24rpx] [&_.goods-list-wrap]:[background:#f5f5f5]">
  <view class="notice-bar-content">
    <view class="notice-bar-text">
      以下商品可使用
      <text class="height-light">{{couponTypeDesc}}</text>
      优惠券
    </view>
    <t-icon name="help-circle" size="32rpx" color="#AAAAAA" bind:tap="openStoreList" />
  </view>
  <view class="goods-list-container">
    <goods-list
      wr-class="goods-list-wrap"
      goodsList="{{goods}}"
      bind:click="goodClickHandle"
      bind:addcart="cartClickHandle"
    />
  </view>
  <floating-button count="{{cartNum}}" />
  <t-popup visible="{{showStoreInfoList}}" placement="bottom" bind:visible-change="closeStoreList">
    <t-icon slot="closeBtn" name="close" size="40rpx" bind:tap="closeStoreList" />
    <view class="popup-content-wrap">
      <view class="popup-content-title"> 规则详情 </view>
      <view class="desc-group-wrap">
        <view wx:if="{{detail && detail.timeLimit}}" class="item-wrap">
          <view class="item-title">优惠券有效时间</view>
          <view class="item-label">{{detail.timeLimit}}</view>
        </view>
        <view wx:if="{{detail && detail.desc}}" class="item-wrap">
          <view class="item-title">优惠券说明</view>
          <view class="item-label">{{detail.desc}}</view>
        </view>
        <view wx:if="{{detail && detail.useNotes}}" class="item-wrap">
          <view class="item-title">使用须知</view>
          <view class="item-label">{{detail.useNotes}}</view>
        </view>
      </view>
    </view>
  </t-popup>
</view>
<t-toast id="t-toast" />
</template>

<json>
{
  "navigationBarTitleText": "活动商品",
  "usingComponents": {
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-popup": "tdesign-miniprogram/popup/popup",
    "t-toast": "tdesign-miniprogram/toast/toast",
    "goods-list": "/components/goods-list/index",
    "floating-button": "../components/floating-button/index"
  }
}</json>
