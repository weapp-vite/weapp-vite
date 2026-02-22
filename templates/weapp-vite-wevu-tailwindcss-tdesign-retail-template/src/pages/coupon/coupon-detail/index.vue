<script setup lang="ts">
import { onLoad, ref } from 'wevu';
import { fetchCouponDetail } from '../../../services/coupon/index';

const id = ref(0);
const detail = ref<any>(null);

function getGoodsList(couponId: number) {
  fetchCouponDetail(couponId).then(({ detail: nextDetail }: { detail: any }) => {
    detail.value = nextDetail;
  });
}

function navGoodListHandle() {
  wx.navigateTo({
    url: `/pages/coupon/coupon-activity-goods/index?id=${id.value}`,
  });
}

onLoad((query: { id?: string }) => {
  const couponId = Number.parseInt(query.id || '0', 10);
  id.value = couponId;
  getGoodsList(couponId);
});

defineExpose({
  detail,
  navGoodListHandle,
});
</script>

<template>
<!-- 优惠券 -->
<view class="coupon-card-wrap [background-color:#fff] [padding:32rpx_32rpx_1rpx]">
  <coupon-card couponDTO="{{detail}}" />
</view>
<!-- 说明 -->
<view class="desc-wrap [margin-top:24rpx] [&_.button-wrap]:[margin:50rpx_32rpx_0]">
  <t-cell-group t-class="desc-group-wrap [border-radius:8rpx] [overflow:hidden] [--cell-label-font-size:26rpx] [--cell-label-line-height:36rpx] [--cell-label-color:#999] [&_.t-class-cell]:[align-items:flex-start] [&_.t-class-title]:[font-size:26rpx] [&_.t-class-title]:[width:140rpx] [&_.t-class-title]:[flex:none] [&_.t-class-title]:[color:#888] [&_.t-class-note]:[font-size:26rpx] [&_.t-class-note]:[word-break:break-all] [&_.t-class-note]:[white-space:pre-line] [&_.t-class-note]:[justify-content:flex-start] [&_.t-class-note]:[color:#333] [&_.t-class-note]:[width:440rpx] [&_.in-popup]:[border-radius:0] [&_.in-popup]:[overflow:auto] [&_.in-popup]:[max-height:828rpx] [&_.wr-cell__title]:[color:#333] [&_.wr-cell__title]:[font-size:28rpx]">
    <t-cell
      wx:if="{{detail && detail.desc}}"
      t-class="t-class-cell"
      t-class-title="t-class-title"
      t-class-note="t-class-note"
      title="规则说明"
      note="{{detail && detail.desc}}"
    />
    <t-cell
      wx:if="{{detail && detail.timeLimit}}"
      t-class="t-class-cell"
      t-class-title="t-class-title"
      t-class-note="t-class-note"
      title="有效时间"
      note="{{detail && detail.timeLimit}}"
    />
    <t-cell
      wx:if="{{detail && detail.storeAdapt}}"
      t-class="t-class-cell"
      t-class-title="t-class-title"
      t-class-note="t-class-note"
      title="适用范围"
      note="{{detail && detail.storeAdapt}}"
    />
    <t-cell
      wx:if="{{detail && detail.useNotes}}"
      t-class="t-class-cell"
      t-class-title="t-class-title"
      t-class-note="t-class-note"
      title="使用须知"
      note="{{detail && detail.useNotes}}"
    />
  </t-cell-group>
  <!-- 查看可用商品 -->
  <view class="button-wrap">
    <t-button shape="round" block bindtap="navGoodListHandle"> 查看可用商品 </t-button>
  </view>
</view>
</template>

<json>
{
  "navigationBarTitleText": "优惠券详情",
  "usingComponents": {
    "coupon-card": "../components/coupon-card/index",
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-cell-group": "tdesign-miniprogram/cell-group/cell-group",
    "t-button": "tdesign-miniprogram/button/button",
    "t-icon": "tdesign-miniprogram/icon/icon"
  }
}</json>
