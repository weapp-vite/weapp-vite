<script lang="ts">
import { fetchCouponList } from '../../../services/coupon/index';

Page({
  data: {
    status: 0,
    list: [
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
    ],

    couponList: [],
  },

  onLoad() {
    this.init();
  },

  init() {
    this.fetchList();
  },

  fetchList(status = this.data.status) {
    let statusInFetch = '';
    switch (Number(status)) {
      case 0: {
        statusInFetch = 'default';
        break;
      }
      case 1: {
        statusInFetch = 'useless';
        break;
      }
      case 2: {
        statusInFetch = 'disabled';
        break;
      }
      default: {
        throw new Error(`unknown fetchStatus: ${statusInFetch}`);
      }
    }
    fetchCouponList(statusInFetch).then((couponList) => {
      this.setData({ couponList });
    });
  },

  tabChange(e) {
    const { value } = e.detail;

    this.setData({ status: value });
    this.fetchList(value);
  },

  goCouponCenterHandle() {
    wx.showToast({ title: '去领券中心', icon: 'none' });
  },

  onPullDownRefresh_() {
    this.setData(
      {
        couponList: [],
      },
      () => {
        this.fetchList();
      },
    );
  },
});
</script>

<template>
<t-tabs
  defaultValue="{{status}}"
  bind:change="tabChange"
  tabList="{{list}}"
  t-class="tabs-external__inner [height:88rpx] [width:100%] [line-height:88rpx] [z-index:100] [font-size:26rpx] [color:#333333] [position:fixed] [width:100vw] [top:0] [left:0] [&_.tabs-external__track]:[background:#fa4126] [&_.tabs-external__item]:[color:#666] [&_.tabs-external__active]:[font-size:28rpx] [&_.tabs-external__active]:[color:#fa4126] [&_.order-nav_.order-nav-item_.bottom-line]:[bottom:12rpx]"
	t-class-item="tabs-external__item"
  t-class-active="tabs-external__active"
  t-class-track="tabs-external__track"
>
	<t-tab-panel
	  wx:for="{{list}}"
	  wx:for-index="index"
	  wx:for-item="tab"
	  wx:key="key"
	  label="{{tab.text}}"
	  value="{{tab.key}}"
	/>
</t-tabs>
<view class="coupon-list-wrap [margin-top:32rpx] [margin-left:32rpx] [margin-right:32rpx] [overflow-y:auto] [padding-bottom:100rpx] [padding-bottom:calc(constant(safe-area-inset-top)_+_100rpx)] [padding-bottom:calc(env(safe-area-inset-bottom)_+_100rpx)] [-webkit-overflow-scrolling:touch] [&_.t-pull-down-refresh__bar]:[background:#fff]">
	<t-pull-down-refresh
	  t-class-indicator="t-class-indicator"
	  id="t-pull-down-refresh"
	  bind:refresh="onPullDownRefresh_"
	  background="#fff"
	>
		<view class="coupon-list-item" wx:for="{{couponList}}" wx:key="key">
			<coupon-card couponDTO="{{item}}" />
		</view>
	</t-pull-down-refresh>
	<view class="center-entry [box-sizing:content-box] [border-top:1rpx_solid_#dce0e4] [background-color:#fff] [position:fixed] [bottom:0] [left:0] [right:0] [height:100rpx] [padding-bottom:0] [padding-bottom:constant(safe-area-inset-top)] [padding-bottom:env(safe-area-inset-bottom)]">
		<view class="center-entry-btn [color:#fa4126] [font-size:28rpx] [text-align:center] [line-height:100rpx] [display:flex] [align-items:center] [justify-content:center] [height:100rpx]" bind:tap="goCouponCenterHandle">
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

<json>
{
  "navigationBarTitleText": "优惠券",
  "usingComponents": {
    "t-pull-down-refresh": "tdesign-miniprogram/pull-down-refresh/pull-down-refresh",
    "t-tabs": "tdesign-miniprogram/tabs/tabs",
    "t-tab-panel": "tdesign-miniprogram/tab-panel/tab-panel",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "coupon-card": "../components/coupon-card/index"
  }
}</json>
