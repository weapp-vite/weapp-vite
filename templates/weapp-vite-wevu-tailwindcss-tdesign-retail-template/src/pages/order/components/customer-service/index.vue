<script setup lang="ts">
defineOptions({
  externalClasses: ['wr-class'],
  properties: {
    phoneNumber: String,
    desc: String
  },
  data() {
    return {
      show: false
    };
  },
  methods: {
    onBtnTap() {
      this.setData({
        show: true
      });
    },
    onDialogClose() {
      this.setData({
        show: false
      });
    },
    onCall() {
      const {
        phoneNumber
      } = this.properties;
      wx.makePhoneCall({
        phoneNumber
      });
    },
    onCallOnlineService() {
      wx.showToast({
        title: '你点击了在线客服'
      });
    }
  }
});
</script>

<template>
<!-- 联系客服按钮 -->
<view class="wr-class customer-service text-btn [display:inline] [color:#333] [font-size:24rpx]" hover-class="text-btn--active [opacity:0.5]" bindtap="onBtnTap">联系客服</view>
<!-- 联系客服弹框 -->
<t-popup visible="{{show}}" placement="bottom" bind:visible-change="onDialogClose">
	<view class="dialog--customer-service [background-color:#f3f4f5] [overflow:hidden] [&_.content]:[font-size:26rpx] [&_.content]:[margin:32rpx_30rpx] [&_.content]:[text-align:center] [&_.content_.title]:[display:inline] [&_.content_.title]:[color:#999999] [&_.content_.title]:[font-weight:bold] [&_.content_.subtitle]:[display:inline] [&_.content_.subtitle]:[color:#999999] [&_.options_.option]:[color:#333333] [&_.options_.option]:[font-size:30rpx] [&_.options_.option]:[text-align:center] [&_.options_.option]:[height:100rpx] [&_.options_.option]:[line-height:100rpx] [&_.options_.option]:[background-color:white] [&_.options_.option--active]:[opacity:0.5] [&_.options_.option_.main]:[color:#333] [&_.options_.option_.online]:[position:relative] [&_.options_.option_.online]:[top:-17rpx] [&_.options_.option_.online]:[margin-bottom:2rpx]">
		<view class="content" wx:if="{{desc}}">
			<view class="title">服务时间:</view>
			<text class="subtitle">{{desc}}</text>
		</view>
		<view class="options">
			<view
			  class="option main"
			  hover-class="text-btn--active [opacity:0.5]"
			  wx:if="{{phoneNumber}}"
			  bindtap="onCall"
			>呼叫 {{phoneNumber}}
			</view>
			<view class="option main online" hover-class="text-btn--active [opacity:0.5]" bindtap="onCallOnlineService">在线客服</view>
			<view class="option" hover-class="text-btn--active [opacity:0.5]" bindtap="onDialogClose">取消</view>
		</view>
	</view>
</t-popup>

</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-popup": "tdesign-miniprogram/popup/popup"
  }
}
</json>
