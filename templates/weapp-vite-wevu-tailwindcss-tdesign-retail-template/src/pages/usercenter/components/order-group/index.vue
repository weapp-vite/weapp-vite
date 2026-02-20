<script lang="ts">
Component({
  externalClasses: ['title-class', 'icon-class', 'number-class'],
  options: {
    multipleSlots: true,
  },
  properties: {
    orderTagInfos: {
      type: Array,
      value: [],
    },
    title: {
      type: String,
      value: '我的订单',
    },
    desc: {
      type: String,
      value: '全部订单',
    },
    isTop: {
      type: Boolean,
      value: true,
    },
    classPrefix: {
      type: String,
      value: 'wr',
    },
  },
  methods: {
    onClickItem(e) {
      this.triggerEvent('onClickItem', e.currentTarget.dataset.item);
    },

    onClickTop() {
      this.triggerEvent('onClickTop', {});
    },
  },
});
</script>

<template>
<view class="order-group [margin-bottom:24rpx] [background-color:#ffffff] [border-radius:16rpx_16rpx_0_0] [&_.order-group__top]:[padding:24rpx_18rpx_24rpx_32rpx] [&_.order-group__top]:[border-radius:16rpx_16rpx_0_0] [&_.order-group__left]:[margin-right:0]">
  <t-cell-group wx:if="{{isTop}}">
    <t-cell
      t-class="order-group__top"
      t-class-left="order-group__left"
      t-class-title="order-group__top__title"
      t-class-note="order-group__top__note"
      title="{{title}}"
      note="{{desc}}"
      bordered="{{false}}"
      arrow
      bind:tap="onClickTop"
    />
  </t-cell-group>
  <view class="order-group__content [overflow:hidden] [width:100%] [height:164rpx] [display:flex] [background-color:#fff] [border-radius:0_0_16rpx_16rpx]">
    <view
      class="order-group__item [overflow:hidden] [display:flex] [flex-direction:column] [align-items:center] [justify-content:center] [flex:1] [&:first-child]:[border-radius:0_0_0_16rpx] [&:last-child]:[border-radius:0_0_16rpx_0]"
      wx:for="{{orderTagInfos}}"
      wx:for-item="item"
      wx:key="index"
      data-item="{{item}}"
      bindtap="onClickItem"
    >
      <view class="order-group__item__icon icon-class [margin-bottom:20rpx] [width:56rpx] [height:56rpx] [position:relative]">
        <t-badge count="{{item.orderNum}}" max-count="{{99}}" color="#FF4646">
          <t-icon
            prefix="{{classPrefix}}"
            name="{{item.iconName}}"
            size="56rpx"
            customStyle="background-image: -webkit-linear-gradient(90deg, #6a6a6a 0%,#929292 100%);-webkit-background-clip: text;-webkit-text-fill-color: transparent;"
          />
        </t-badge>
      </view>
      <view class="order-group__item__title title-class [font-size:24rpx] [color:#666] [line-height:32rpx]">{{item.title}}</view>
    </view>
  </view>
</view>
</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-cell-group": "tdesign-miniprogram/cell-group/cell-group",
    "t-badge": "tdesign-miniprogram/badge/badge",
    "t-icon": "tdesign-miniprogram/icon/icon"
  }
}</json>
