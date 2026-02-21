<script setup lang="ts">
defineOptions({
  externalClasses: ['wr-class'],
  options: {
    multipleSlots: true
  },
  properties: {
    goodsDetailInfo: {
      type: String,
      value: ''
    },
    sellerReply: {
      type: String,
      value: ''
    },
    userHeadUrl: {
      type: String,
      value: ''
    },
    userName: {
      type: String,
      default: ''
    },
    commentContent: {
      type: String,
      value: ''
    },
    commentScore: {
      type: Number,
      value: 0
    },
    commentTime: {
      type: String,
      value: ''
    },
    commentResources: {
      type: Array,
      value: []
    }
  },
  data() {
    return {
      showMoreStatus: false,
      showContent: false,
      hideText: false,
      eleHeight: null,
      overText: false,
      isDisabled: true,
      startColors: ['#FFC51C', '#DDDDDD']
    };
  },
  methods: {}
});
</script>

<template>
<view class="comments-card-item wr-class [padding:32rpx] [display:flex] [background-color:#fff] [position:relative]">
  <view class="comments-card-item-container [width:100%] [&_.comments-title]:[display:flex] [&_.comments-title]:[align-items:center] [&_.comments-title]:[position:relative] [&_.comments-card-reply]:[background-color:#f5f5f5] [&_.comments-card-reply]:[padding:24rpx_16rpx] [&_.comments-card-reply]:[margin-top:24rpx] [&_.comments-card-reply_.prefix]:[font-size:26rpx] [&_.comments-card-reply_.prefix]:[font-weight:bold] [&_.comments-card-reply_.prefix]:[color:#666666] [&_.comments-card-reply_.content]:[font-size:26rpx] [&_.comments-card-reply_.content]:[color:#666666]">
    <view class="comments-title [&_.userName]:[font-size:26rpx] [&_.userName]:[color:#333333] [&_.userName]:[margin-left:24rpx] [&_.commentTime]:[font-size:24rpx] [&_.commentTime]:[color:#999999] [&_.commentTime]:[position:absolute] [&_.commentTime]:[right:0]">
      <view class="comments-card-item-userImg [display:flex] [&_.userImg]:[width:64rpx] [&_.userImg]:[height:64rpx] [&_.userImg]:[border-radius:50%]">
        <t-image t-class="userImg" src="{{userHeadUrl}}" />
      </view>
      <view class="userName">{{userName}}</view>
      <text class="commentTime">{{commentTime}}</text>
    </view>
    <view class="comments-info [display:flex] [align-items:center] [margin-top:18rpx] [&_.rate]:[margin-right:24rpx] [&_.goods-info-text]:[font-size:24rpx] [&_.goods-info-text]:[color:#999999]">
      <view class="rate">
        <t-rate value="{{commentScore}}" size="14" gap="2" color="{{['#ffc51c', '#ddd']}}" />
      </view>
      <view class="goods-info-text" wx:if="{{goodsDetailInfo}}">{{goodsDetailInfo}}</view>
    </view>
    <view class="comments-card-item-container-content [margin-top:16rpx] [position:relative] [&_.content-text]:[font-size:28rpx] [&_.content-text]:[white-space:normal] [&_.content-text]:[word-break:break-all] [&_.content-text]:[font-weight:normal] [&_.hide-text]:[overflow:hidden] [&_.hide-text]:[text-overflow:ellipsis] [&_.hide-text]:[-webkit-line-clamp:5] [&_.hide-text]:[text-align:justify] [&_.hide-text]:[display:-webkit-box] [&_.hide-text]:[-webkit-box-orient:vertical] [&_.showMore]:[position:absolute] [&_.showMore]:[width:112rpx] [&_.showMore]:[height:36rpx] [&_.showMore]:[bottom:0] [&_.showMore]:[right:0] [&_.showMore]:[background:linear-gradient(_to_right,_rgba(255,_255,_255,_0.2)_0,_rgba(255,_255,_255,_0.45)_20%,_rgba(255,_255,_255,_0.7)_25%,_rgba(255,_255,_255,_0.9)_30%,_rgba(255,_255,_255,_0.95)_35%,_#ffffff_50%,_#fff_100%_)] [&_.showMore]:[font-size:26rpx] [&_.showMore]:[color:#fa550f] [&_.showMore]:[line-height:36rpx] [&_.showMore]:[text-align:right]">
      <view class="content-text" hidden="{{showContent}}"> {{commentContent}} </view>
    </view>
    <view class="comments-card-item-container-image [margin-top:24rpx] [display:flex] [justify-content:space-between] [flex-wrap:wrap] [&_.commentImg]:[border-radius:8rpx] [&_.commentImg]:[margin-top:12rpx] [&_.commentImg3]:[width:196rpx] [&_.commentImg3]:[height:196rpx] [&_.commentImg2]:[width:300rpx] [&_.commentImg2]:[height:300rpx] [&_.commentImg1]:[width:404rpx] [&_.commentImg1]:[height:404rpx]" wx:if="{{commentResources.length > 0}}">
      <images-videos resources="{{commentResources}}" />
    </view>
    <view class="comments-card-reply" wx:if="{{sellerReply}}">
      <text class="prefix">店家回复：</text>
      <text class="content">{{sellerReply}}</text>
    </view>
  </view>
</view>
</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-rate": "tdesign-miniprogram/rate/rate",
    "images-videos": "./components/images-videos",
    "t-image": "/components/webp-image/index"
  }
}</json>
