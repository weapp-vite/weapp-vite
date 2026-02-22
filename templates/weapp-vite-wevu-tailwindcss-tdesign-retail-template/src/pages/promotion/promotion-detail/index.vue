<script setup lang="ts">
import Toast from 'tdesign-miniprogram/toast/index';
import { onLoad, ref, useNativeInstance } from 'wevu';
import { fetchPromotion } from '../../../services/promotion/detail';

const nativeInstance = useNativeInstance() as any;

const list = ref<any[]>([]);
const banner = ref('');
const time = ref(0);
const showBannerDesc = ref(false);
const statusTag = ref('');
const independentID = ref(`promotion-${Date.now()}`);
const useBannerDescSlot = ref(false);
const cdClass = ref('');

function countDownFinishHandle() {
  statusTag.value = 'finish';
  time.value = 0;
}

function getGoodsList(promotionID: number) {
  fetchPromotion(promotionID).then(({
    list: goodsList,
    banner: nextBanner,
    time: nextTime,
    showBannerDesc: nextShowBannerDesc,
    statusTag: nextStatusTag,
  }: {
    list: any[]
    banner: string
    time: number
    showBannerDesc: boolean
    statusTag: string
  }) => {
    const goods = goodsList.map((item: any) => ({
      ...item,
      tags: Array.isArray(item.tags) ? item.tags.map((v: any) => v.title) : [],
    }));
    list.value = goods;
    banner.value = nextBanner;
    time.value = nextTime;
    showBannerDesc.value = nextShowBannerDesc;
    statusTag.value = nextStatusTag;
  });
}

function goodClickHandle(e: any) {
  const index = Number(e?.detail?.index);
  if (!Number.isFinite(index) || index < 0) {
    return;
  }
  const spuId = list.value[index]?.spuId;
  if (spuId == null) {
    return;
  }
  wx.navigateTo({
    url: `/pages/goods/details/index?spuId=${spuId}`,
  });
}

function cardClickHandle() {
  Toast({
    context: nativeInstance,
    selector: '#t-toast',
    message: '点击加购',
  });
}

function bannerClickHandle() {
  Toast({
    context: nativeInstance,
    selector: '#t-toast',
    message: '点击规则详情',
  });
}

onLoad((query: Record<string, string>) => {
  const promotionID = Number.parseInt(query.promotion_id || '0', 10);
  getGoodsList(promotionID);
});

defineExpose({
  list,
  banner,
  time,
  showBannerDesc,
  statusTag,
  independentID,
  useBannerDescSlot,
  cdClass,
  countDownFinishHandle,
  goodClickHandle,
  cardClickHandle,
  bannerClickHandle,
});
</script>

<template>
<view id="js-page-wrap" class="promotion-detail-container [&_.wrap]:[display:block] [&_.wrap]:[padding:0_24rpx] [&_.wrap]:[background:linear-gradient(#fff,_#f5f5f5)] [&_.t-class-promotion-head]:[width:702rpx] [&_.t-class-promotion-head]:[height:160rpx] [&_.t-class-promotion-head]:[border-radius:8rpx] [&_.wrap_.count-down-wrap]:[display:flex] [&_.wrap_.count-down-wrap]:[flex-direction:row] [&_.wrap_.count-down-wrap]:[justify-content:flex-start] [&_.wrap_.count-down-wrap]:[align-items:baseline] [&_.wrap_.count-down-wrap]:[line-height:34rpx] [&_.wrap_.count-down-wrap_.in-banner-count-down-wrap]:[position:absolute] [&_.wrap_.count-down-wrap_.in-banner-count-down-wrap]:[bottom:32rpx] [&_.wrap_.count-down-wrap_.in-banner-count-down-wrap]:[left:32rpx] [&_.wrap_.count-down-wrap_.in-banner-count-down-wrap]:[right:32rpx] [&_.wrap_.count-down-wrap_.status-tag]:[height:32rpx] [&_.wrap_.count-down-wrap_.status-tag]:[line-height:32rpx] [&_.wrap_.count-down-wrap_.status-tag]:[font-size:20rpx] [&_.wrap_.count-down-wrap_.status-tag]:[margin-right:12rpx] [&_.wrap_.count-down-wrap_.status-tag]:[border-radius:16rpx] [&_.wrap_.count-down-wrap_.status-tag]:[padding:0_12rpx] [&_.wrap_.count-down-wrap_.status-tag_.before]:[color:#fff] [&_.wrap_.count-down-wrap_.status-tag_.before]:[background-color:#ff9853] [&_.wrap_.count-down-wrap_.status-tag_.finish]:[color:#fff] [&_.wrap_.count-down-wrap_.status-tag_.finish]:[background-color:#ccc] [&_.wrap_.count-down-wrap_.count-down-label]:[color:#666] [&_.wrap_.count-down-wrap_.count-down-label]:[font-size:24rpx] [&_.wrap_.count-down-wrap_.count-down-label]:[margin-right:0.5em] [&_.wrap_.count-down-wrap_.detail-entry]:[margin-left:auto] [&_.wrap_.count-down-wrap_.detail-entry]:[height:40rpx] [&_.wrap_.count-down-wrap_.detail-entry-label]:[color:#fff] [&_.wrap_.count-down-wrap_.detail-entry-label]:[font-size:24rpx] [&_.wrap_.count-down-wrap_.detail-entry-label]:[margin-right:12rpx] [&_.wrap_.count-down-wrap_.after-banner-count-down-wrap]:[padding:10rpx] [&_.wrap_.count-down-wrap_.after-banner-count-down-wrap_.detail-entry]:[display:flex] [&_.wrap_.count-down-wrap_.after-banner-count-down-wrap_.detail-entry]:[align-items:center] [&_.wrap_.count-down-wrap_.after-banner-count-down-wrap_.detail-entry-label]:[color:#999] [&_.wrap_.count-down-wrap_.after-banner-count-down-wrap_.detail-entry-label]:[margin-right:0] [&_.wrap_.gl-empty-wrap]:[margin-top:180rpx] [&_.wrap_.gl-empty-img]:[width:240rpx] [&_.wrap_.gl-empty-img]:[height:240rpx] [&_.wrap_.gl-empty-img]:[display:block] [&_.wrap_.gl-empty-img]:[margin:0_auto] [&_.wrap_.gl-empty-label]:[font-size:28rpx] [&_.wrap_.gl-empty-label]:[color:#999] [&_.wrap_.gl-empty-label]:[margin-top:40rpx] [&_.wrap_.gl-empty-label]:[text-align:center] [&_.goods-list-container]:[background:#f5f5f5] [&_.promotion-goods-list]:[padding:20rpx_24rpx] [&_.promotion-goods-list]:[background-color:#f5f5f5]">
  <view wx:if="{{banner}}" class="wrap" id="{{independentID}}">
    <view class="banner-wrap">
      <t-image src="{{banner}}" mode="aspectFill" webp="{{true}}" t-class="t-class-promotion-head" />
      <view
        wx:if="{{!showBannerDesc && (time >= 0 || statusTag === 'finish')}}"
        class="count-down-wrap in-banner-count-down-wrap"
      >
        <block wx:if="{{statusTag === 'finish'}}">
          <view class="status-tag {{statusTag}}">已结束</view>
          <text class="count-down-label">活动已结束</text>
        </block>
        <block wx:else>
          <view wx:if="{{statusTag === 'before'}}" class="status-tag {{statusTag}}"> 未开始 </view>
          <text class="count-down-label">距结束仅剩</text>
          <count-down
            wx:if="{{time > 0}}"
            t-class="wr-cd-class"
            time="{{time}}"
            format="DD天 HH:mm:ss"
            bind:finish="countDownFinishHandle"
          />
        </block>
        <view class="detail-entry" bind:tap="bannerClickHandle">
          <text class="detail-entry-label">规则详情</text>
          <t-icon name="chevron-right" size="34rpx" style="color: #999" />
        </view>
      </view>
      <view
        wx:if="{{showBannerDesc && (useBannerDescSlot || time >= 0 || statusTag === 'finish')}}"
        class="banner-desc-wrap"
      >
        <block wx:if="{{useBannerDescSlot}}">
          <slot name="banner-desc" />
        </block>
        <block wx:else>
          <view class="count-down-wrap after-banner-count-down-wrap">
            <block wx:if="{{statusTag === 'finish'}}">
              <view class="status-tag {{statusTag}}">已结束</view>
              <text class="count-down-label">活动已结束</text>
            </block>
            <block wx:else>
              <view wx:if="{{statusTag === 'before'}}" class="status-tag {{statusTag}}"> 未开始 </view>
              <text class="count-down-label">距结束仅剩</text>
              <count-down
                class="{{cdClass}}"
                wr-class="wr-cd-class"
                wx:if="{{time > 0}}"
                time="{{time}}"
                format="DD天 HH:mm:ss"
                bind:finish="countDownFinishHandle"
              />
            </block>
            <view class="detail-entry" bind:tap="bannerClickHandle">
              <text class="detail-entry-label">规则详情</text>
              <t-icon name="chevron-right" size="34rpx" style="color: #999" />
            </view>
          </view>
        </block>
      </view>
    </view>
  </view>
  <view wx:if="{{list && list.length>0}}" class="promotion-goods-list">
    <goods-list
      wr-class="goods-list-container"
      goodsList="{{list}}"
      bind:click="goodClickHandle"
      bind:addcart="cardClickHandle"
    />
  </view>
  <t-toast id="t-toast" />
</view>
</template>

<json>
{
  "navigationBarTitleText": "营销详情",
  "usingComponents": {
    "t-toast": "tdesign-miniprogram/toast/toast",
    "t-image": "/components/webp-image/index",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "count-down": "tdesign-miniprogram/count-down/count-down",
    "goods-list": "/components/goods-list/index"
  }
}
</json>
