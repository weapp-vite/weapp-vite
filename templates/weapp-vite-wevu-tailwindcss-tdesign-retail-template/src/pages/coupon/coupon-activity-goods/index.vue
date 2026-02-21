<script setup lang="ts">
import { fetchCouponDetail } from '../../../services/coupon/index';
import { fetchGoodsList } from '../../../services/good/fetchGoods';
import Toast from 'tdesign-miniprogram/toast/index';
defineOptions({
  data() {
    return {
      goods: [],
      detail: {},
      couponTypeDesc: '',
      showStoreInfoList: false,
      cartNum: 2
    };
  },
  id: '',
  onLoad(query) {
    const id = parseInt(query.id);
    this.id = id;
    this.getCouponDetail(id);
    this.getGoodsList(id);
  },
  getCouponDetail(id) {
    fetchCouponDetail(id).then(({
      detail
    }) => {
      this.setData({
        detail
      });
      if (detail.type === 2) {
        if (detail.base > 0) {
          this.setData({
            couponTypeDesc: `满${detail.base / 100}元${detail.value}折`
          });
        } else {
          this.setData({
            couponTypeDesc: `${detail.value}折`
          });
        }
      } else if (detail.type === 1) {
        if (detail.base > 0) {
          this.setData({
            couponTypeDesc: `满${detail.base / 100}元减${detail.value / 100}元`
          });
        } else {
          this.setData({
            couponTypeDesc: `减${detail.value / 100}元`
          });
        }
      }
    });
  },
  getGoodsList(id) {
    fetchGoodsList(id).then(goods => {
      this.setData({
        goods
      });
    });
  },
  openStoreList() {
    this.setData({
      showStoreInfoList: true
    });
  },
  closeStoreList() {
    this.setData({
      showStoreInfoList: false
    });
  },
  goodClickHandle(e) {
    const {
      index
    } = e.detail;
    const {
      spuId
    } = this.data.goods[index];
    wx.navigateTo({
      url: `/pages/goods/details/index?spuId=${spuId}`
    });
  },
  cartClickHandle() {
    Toast({
      context: this,
      selector: '#t-toast',
      message: '点击加入购物车'
    });
  }
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
