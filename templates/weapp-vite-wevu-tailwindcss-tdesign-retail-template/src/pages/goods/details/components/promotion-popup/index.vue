<script setup lang="ts">
defineOptions({
  options: {
    multipleSlots: true
  },
  properties: {
    list: Array,
    title: {
      type: String,
      value: '促销说明'
    },
    show: {
      type: Boolean
    }
  },
  // data: {
  //   list: [],
  // },

  methods: {
    change(e) {
      const {
        index
      } = e.currentTarget.dataset;
      this.triggerEvent('promotionChange', {
        index
      });
    },
    closePromotionPopup() {
      this.triggerEvent('closePromotionPopup', {
        show: false
      });
    }
  }
});
</script>

<template>
<t-popup visible="{{show}}" placement="bottom" bind:visible-change="closePromotionPopup">
	<view class="promotion-popup-container [background-color:#ffffff] [position:relative] [z-index:100] [border-radius:16rpx_16rpx_0_0] [&_.promotion-popup-close]:[position:absolute] [&_.promotion-popup-close]:[right:30rpx] [&_.promotion-popup-close]:[top:30rpx] [&_.promotion-popup-close]:[z-index:9] [&_.promotion-popup-close]:[color:rgba(153,_153,_153,_1)] [&_.promotion-popup-close_.market]:[font-size:25rpx] [&_.promotion-popup-close_.market]:[color:#999] [&_.promotion-popup-title]:[height:100rpx] [&_.promotion-popup-title]:[position:relative] [&_.promotion-popup-title]:[display:flex] [&_.promotion-popup-title]:[align-items:center] [&_.promotion-popup-title]:[justify-content:center] [&_.promotion-popup-title]:[font-size:32rpx] [&_.promotion-popup-title]:[color:#222427] [&_.promotion-popup-title]:[font-weight:600] [&_.promotion-popup-content]:[min-height:400rpx] [&_.promotion-popup-content]:[max-height:600rpx] [&_.promotion-popup-content]:[padding-bottom:calc(env(safe-area-inset-bottom)_+_20rpx)] [&_.promotion-popup-content]:[overflow-y:scroll] [&_.promotion-popup-content]:[-webkit-overflow-scrolling:touch] [&_.promotion-popup-content_.promotion-detail-list]:[margin:0_30rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item:last-child]:[margin-bottom:env(safe-area-inset-bottom)] [&_.promotion-popup-content_.promotion-detail-list_.list-item:last-child]:[border-bottom:0] [&_.promotion-popup-content_.promotion-detail-list_.list-item:last-child]:[padding-bottom:calc(28rpx_+_env(safe-area-inset-bottom))] [&_.promotion-popup-content_.promotion-detail-list_.list-item]:[display:flex] [&_.promotion-popup-content_.promotion-detail-list_.list-item]:[justify-content:space-between] [&_.promotion-popup-content_.promotion-detail-list_.list-item]:[padding:10rpx_0_28rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item]:[position:relative] [&_.promotion-popup-content_.promotion-detail-list_.list-item]:[font-size:24rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item]:[color:#222427] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:[box-sizing:border-box] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:[font-size:20rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:[line-height:32rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:[padding:2rpx_12rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:[background-color:#ffece9] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:[margin-right:16rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:[display:inline-flex] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:[color:#fa4126] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:[border-radius:54rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:[flex-shrink:0] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:[position:relative] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.tag]:[top:2rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.content]:[font-size:28rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.content]:[color:#222427] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.content]:[flex:1] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.content]:[line-height:40rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.content]:[display:flex] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.content_.list-content]:[width:440rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.content_.list-content]:[white-space:nowrap] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.content_.list-content]:[text-overflow:ellipsis] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.content_.list-content]:[overflow:hidden] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.content_.list-content]:[display:inline-block] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.collect-btn]:[font-size:24rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.collect-btn]:[flex-shrink:0] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.collect-btn]:[margin-left:20rpx] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.collect-btn]:[display:flex] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.collect-btn]:[align-items:center] [&_.promotion-popup-content_.promotion-detail-list_.list-item_.collect-btn_.linkText]:[margin-right:8rpx]">
		<view class="promotion-popup-close" bindtap="closePromotionPopup">
			<t-icon name="close" size="36rpx" />
		</view>
		<view class="promotion-popup-title">
			<view class="title">{{title}}</view>
		</view>
		<view class="promotion-popup-content">
			<view class="promotion-detail-list">
				<view
				  class="list-item"
				  wx:for="{{list}}"
				  wx:key="index"
				  bindtap="change"
				  data-index="{{index}}"
				>
					<view class="tag">{{item.tag}}</view>
					<view class="content">
						<text class="list-content">{{item.label ? item.label : ''}}</text>
					</view>
					<t-icon
					  class="collect-btn"
					  name="chevron-right"
					  size="40rpx"
					  color="#bbb"
					/>
				</view>
			</view>
		</view>
		<slot name="promotion-bottom" />
	</view>
</t-popup>

</template>

<json>
{
    "component": true,
    "usingComponents": {
        "t-popup": "tdesign-miniprogram/popup/popup",
        "t-icon": "tdesign-miniprogram/icon/icon"
    }
}</json>
