<script lang="ts">
Page({
  data: {
    totalPaid: 0,
    orderNo: '',
    groupId: '',
    groupon: null,
    spu: null,
    adUrl: '',
  },

  onLoad(options) {
    const { totalPaid = 0, orderNo = '', groupId = '' } = options;
    this.setData({
      totalPaid,
      orderNo,
      groupId,
    });
  },

  onTapReturn(e) {
    const target = e.currentTarget.dataset.type;
    const { orderNo } = this.data;
    if (target === 'home') {
      wx.switchTab({ url: '/pages/home/home' });
    } else if (target === 'orderList') {
      wx.navigateTo({
        url: `/pages/order/order-list/index?orderNo=${orderNo}`,
      });
    } else if (target === 'order') {
      wx.navigateTo({
        url: `/pages/order/order-detail/index?orderNo=${orderNo}`,
      });
    }
  },

  navBackHandle() {
    wx.navigateBack();
  },
});
</script>

<template>
<t-navbar background="#ffffff" left-icon="slot" />
<view class="pay-result [display:flex] [flex-direction:column] [align-items:center] [width:100%] [&_.pay-status]:[margin-top:100rpx] [&_.pay-status]:[font-size:48rpx] [&_.pay-status]:[line-height:72rpx] [&_.pay-status]:[font-weight:bold] [&_.pay-status]:[color:#333333] [&_.pay-status]:[display:flex] [&_.pay-status]:[align-items:center] [&_.pay-status]:[padding-left:12rpx] [&_.pay-money]:[color:#666666] [&_.pay-money]:[font-size:28rpx] [&_.pay-money]:[line-height:48rpx] [&_.pay-money]:[margin-top:28rpx] [&_.pay-money]:[display:flex] [&_.pay-money]:[align-items:baseline] [&_.pay-money_.pay-money__price]:[font-size:36rpx] [&_.pay-money_.pay-money__price]:[line-height:48rpx] [&_.pay-money_.pay-money__price]:[color:#fa4126] [&_.btn-wrapper]:[margin-top:48rpx] [&_.btn-wrapper]:[padding:12rpx_32rpx] [&_.btn-wrapper]:[display:flex] [&_.btn-wrapper]:[align-items:center] [&_.btn-wrapper]:[justify-content:space-between] [&_.btn-wrapper]:[width:100%] [&_.btn-wrapper]:[box-sizing:border-box] [&_.btn-wrapper_.status-btn]:[height:88rpx] [&_.btn-wrapper_.status-btn]:[width:334rpx] [&_.btn-wrapper_.status-btn]:[border-radius:44rpx] [&_.btn-wrapper_.status-btn]:[border:2rpx_solid_#fa4126] [&_.btn-wrapper_.status-btn]:[color:#fa4126] [&_.btn-wrapper_.status-btn]:[font-size:28rpx] [&_.btn-wrapper_.status-btn]:[font-weight:bold] [&_.btn-wrapper_.status-btn]:[line-height:88rpx] [&_.btn-wrapper_.status-btn]:[text-align:center]">
	<view class="pay-status">
		<t-icon name="check-circle-filled" size="60rpx" color="#47D368" />
		<text>支付成功</text>
	</view>
	<view class="pay-money">
		微信支付：
		<price
		 wx:if="{{totalPaid}}"
		 price="{{totalPaid}}"
		 wr-class="pay-money__price"
		 decimalSmaller
		 fill
		/>
	</view>
	<view class="btn-wrapper">
		<view class="status-btn" data-type="orderList" bindtap="onTapReturn">查看订单</view>
		<view class="status-btn" data-type="home" bindtap="onTapReturn">返回首页</view>
	</view>
</view>

</template>

<json>
{
  "navigationBarTitleText": "支付结果",
  "navigationStyle": "custom",
  "usingComponents": {
    "t-navbar": "tdesign-miniprogram/navbar/navbar",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "price": "/components/price/index"
  }
}</json>
