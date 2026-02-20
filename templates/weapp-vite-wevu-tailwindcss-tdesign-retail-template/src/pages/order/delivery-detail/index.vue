<script lang="ts">
Page({
  data: {
    logisticsData: {
      logisticsNo: '',
      nodes: [],
      company: '',
      phoneNumber: '',
    },
    active: 0,
  },

  onLoad(query) {
    let data;
    try {
      data = JSON.parse(decodeURIComponent(query.data || '{}'));
    } catch (e) {
      console.warn('物流节点数据解析失败', e);
    }
    if (Number(query.source) === 2) {
      const service = {
        company: data.logisticsCompanyName,
        logisticsNo: data.logisticsNo,
        nodes: data.nodes,
      };
      this.setData({
        logisticsData: service,
      });
    } else if (data) {
      this.setData({ logisticsData: data });
    }
  },

  onLogisticsNoCopy() {
    wx.setClipboardData({ data: this.data.logisticsData.logisticsNo });
  },

  onCall() {
    const { phoneNumber } = this.data.logisticsData;
    wx.makePhoneCall({
      phoneNumber,
    });
  },
});
</script>

<template>
<wxs src="./isUrl.wxs" module="isUrl"></wxs>

<view class="page-section cells [margin-top:24rpx] [background-color:white] [&_.order-group__left]:[margin-right:0]" wx:if="{{logisticsData.logisticsNo || logisticsData.company}}">
	<t-cell-group>
		<t-cell
		  title="快递单号"
		  t-class-title="wr-cell__title"
		  t-class-note="wr-cell__value"
		  t-class-left="order-group__left"
		  wx:if="{{logisticsData.logisticsNo}}"
		  bordered="{{false}}"
		>
			<text slot="note" class="logistics-no [display:inline-block] [text-align:left] [word-break:break-all] [color:#333]">{{logisticsData.logisticsNo}}</text>
			<view
			  slot="right-icon"
			  class="text-btn [margin-left:20rpx] [display:inline] [font-size:24rpx] [padding:0_15rpx] [border:1rpx_solid_#ddd] [border-radius:28rpx] [color:#333]"
			  hover-class="text-btn--active [opacity:0.5]"
			  bindtap="onLogisticsNoCopy"
			>复制
			</view>
		</t-cell>
		<t-cell
		  title="物流公司"
		  t-class-title="wr-cell__title"
		  t-class-note="wr-cell__value"
		  t-class-left="order-group__left"
		  bordered="{{false}}"
		  wx:if="{{logisticsData.company}}"
		  note="{{logisticsData.company + (logisticsData.phoneNumber ? '-' + logisticsData.phoneNumber : '')}}"
		>
			<view
			  slot="right-icon"
			  class="text-btn [margin-left:20rpx] [display:inline] [font-size:24rpx] [padding:0_15rpx] [border:1rpx_solid_#ddd] [border-radius:28rpx] [color:#333]"
			  hover-class="text-btn--active [opacity:0.5]"
			  bindtap="onCall"
			  wx:if="{{logisticsData.phoneNumber}}"
			>
				拨打
			</view>
		</t-cell>
	</t-cell-group>
</view>
<view class="page-section cell-steps [margin-top:24rpx] [background-color:white] [padding:8rpx] [&_.order-group__left]:[margin-right:0]">
	<t-steps
	  class="page-section__steps [padding:24rpx]"
	  t-class="steps [&_.step-title]:[font-weight:bold] [&_.step-title]:[color:#333] [&_.step-title]:[font-size:30rpx] [&_.step-desc]:[color:#333333] [&_.step-desc]:[font-size:28rpx] [&_.step-date]:[color:#999999] [&_.step-date]:[font-size:24rpx] [&_.t-step--vertical_.t-step--default-anchor_.t-steps-item--process_.t-steps-item__icon-number]:[background:#ffece9] [&_.t-step--vertical_.t-step--default-anchor_.t-steps-item--process_.t-steps-item__icon-number]:[color:white] [&_.t-step--vertical_.t-step--default-anchor_.t-steps-item--process_.t-steps-item__icon-number]:[border:none] [&_.t-step--vertical_.t-step--default-anchor_.t-steps-item--default_.t-steps-item__icon-number]:[color:white] [&_.t-step--vertical_.t-step--default-anchor_.t-steps-item--default_.t-steps-item__icon-number]:[background:#f5f5f5] [&_.t-step--vertical_.t-step--default-anchor_.t-steps-item--default_.t-steps-item__icon-number]:[border:none]"
	  layout="vertical"
	  current="{{active}}"
	>
		<t-step
		  class="steps [&_.step-title]:[font-weight:bold] [&_.step-title]:[color:#333] [&_.step-title]:[font-size:30rpx] [&_.step-desc]:[color:#333333] [&_.step-desc]:[font-size:28rpx] [&_.step-date]:[color:#999999] [&_.step-date]:[font-size:24rpx] [&_.t-step--vertical_.t-step--default-anchor_.t-steps-item--process_.t-steps-item__icon-number]:[background:#ffece9] [&_.t-step--vertical_.t-step--default-anchor_.t-steps-item--process_.t-steps-item__icon-number]:[color:white] [&_.t-step--vertical_.t-step--default-anchor_.t-steps-item--process_.t-steps-item__icon-number]:[border:none] [&_.t-step--vertical_.t-step--default-anchor_.t-steps-item--default_.t-steps-item__icon-number]:[color:white] [&_.t-step--vertical_.t-step--default-anchor_.t-steps-item--default_.t-steps-item__icon-number]:[background:#f5f5f5] [&_.t-step--vertical_.t-step--default-anchor_.t-steps-item--default_.t-steps-item__icon-number]:[border:none]"
		  t-class-title="step-title"
		  wx:for="{{logisticsData.nodes}}"
		  wx:for-item="item"
		  wx:for-index="index"
		  wx:key="index"
		  title="{{item.title}}"
		  icon="slot"
		>
			<block wx:if="{{isUrl.isUrl(item.icon)}}">
				<t-image
				  class="cell-steps__imgWrapper [width:48rpx] [height:48rpx]"
				  slot="icon"
				  t-class="cell-steps__img [width:48rpx] [height:48rpx]"
				  src="{{item.icon}}"
				/>
			</block>
			<block wx:else>
				<t-icon
				  slot="icon"
				  size="32rpx"
				  prefix="wr"
				  color="{{index === 0 ? '#ef5433' : '#bbb'}}"
				  name="{{item.icon}}"
				/>
			</block>
			<view slot="content">
				<view class="step-desc">{{item.desc}}</view>
				<view class="step-date">{{item.date}}</view>
			</view>
		</t-step>
	</t-steps>
</view>

</template>

<json>
{
  "navigationBarTitleText": "物流信息",
  "usingComponents": {
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-cell-group": "tdesign-miniprogram/cell-group/cell-group",
    "t-image": "/components/webp-image/index",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-steps": "tdesign-miniprogram/steps/steps",
    "t-step": "tdesign-miniprogram/step-item/step-item"
  }
}</json>
