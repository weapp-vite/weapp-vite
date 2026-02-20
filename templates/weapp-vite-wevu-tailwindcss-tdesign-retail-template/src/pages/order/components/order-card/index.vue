<script lang="ts">
Component({
  externalClasses: ['wr-class', 'header-class', 'title-class'],

  options: {
    multipleSlots: true,
  },

  relations: {
    '../order-goods-card/index': {
      type: 'descendant',
      linked(target) {
        this.children.push(target);
        this.setHidden();
      },
      unlinked(target) {
        this.children = this.children.filter((item) => item !== target);
      },
    },
    '../goods-card/index': {
      type: 'descendant',
      linked(target) {
        this.children.push(target);
        this.setHidden();
      },
      unlinked(target) {
        this.children = this.children.filter((item) => item !== target);
      },
    },
    '../specs-goods-card/index': {
      type: 'descendant',
      linked(target) {
        this.children.push(target);
        this.setHidden();
      },
      unlinked(target) {
        this.children = this.children.filter((item) => item !== target);
      },
    },
  },

  created() {
    this.children = [];
  },

  properties: {
    order: {
      type: Object,
      observer(order) {
        if (!order?.goodsList) return;
        const goodsCount = order.goodsList.length;
        this.setData({
          goodsCount,
        });
      },
    },
    useTopRightSlot: Boolean,
    //  初始显示的商品数量，超出部分会隐藏。
    defaultShowNum: {
      type: null,
      value: 10,
    },
    useLogoSlot: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    showAll: true, // 是否展示所有商品，设置为false，可以使用展开更多功能
    goodsCount: 0,
  },

  methods: {
    setHidden() {
      const isHidden = !this.data.showAll;
      this.children.forEach(
        (c, i) => i >= this.properties.defaultShowNum && c.setHidden(isHidden),
      );
    },

    onOrderCardTap() {
      this.triggerEvent('cardtap');
    },

    onShowMoreTap() {
      this.setData({ showAll: true }, () => this.setHidden());
      this.triggerEvent('showall');
    },
  },
});
</script>

<template>
<view class="order-card wr-class [margin:24rpx_0] [padding:24rpx_32rpx_24rpx] [background-color:white] [border-radius:8rpx] [&_.header]:[display:flex] [&_.header]:[justify-content:space-between] [&_.header]:[align-items:center] [&_.header]:[margin-bottom:24rpx] [&_.header_.store-name]:[font-size:28rpx] [&_.header_.store-name]:[font-weight:normal] [&_.header_.store-name]:[color:#333333] [&_.header_.store-name]:[display:flex] [&_.header_.store-name]:[align-items:center] [&_.header_.store-name]:[line-height:40rpx] [&_.header_.store-name__logo]:[margin-right:16rpx] [&_.header_.store-name__logo]:[font-size:40rpx] [&_.header_.store-name__logo]:[width:48rpx] [&_.header_.store-name__logo]:[height:48rpx] [&_.header_.store-name__label]:[max-width:500rpx] [&_.header_.store-name__label]:[overflow:hidden] [&_.header_.store-name__label]:[text-overflow:ellipsis] [&_.header_.store-name__label]:[word-break:break-all] [&_.header_.store-name__label]:[white-space:nowrap] [&_.header_.order-status]:[font-size:26rpx] [&_.header_.order-status]:[line-height:40rpx] [&_.header_.order-status]:[color:#fa4126] [&_.more-mask]:[padding:20rpx_0] [&_.more-mask]:[text-align:center] [&_.more-mask]:[background-color:white] [&_.more-mask]:[color:#fa4126] [&_.more-mask]:[font-size:24rpx]" bind:tap="onOrderCardTap">
  <view class="header header-class">
    <view class="store-name title-class">
      <block wx:if="{{!useLogoSlot}}">
        <t-image wx:if="{{order.storeLogo}}" t-class="store-name__logo" src="{{order.storeLogo}}" />
        <t-icon wx:else prefix="wr" class="store-name__logo" name="store" size="40rpx" color="inherit" />
        <view class="store-name__label">{{order.storeName}}</view>
      </block>
      <slot wx:else name="top-left" />
    </view>
    <view wx:if="{{!useTopRightSlot}}" class="order-status">{{order.statusDesc}}</view>
    <slot wx:else name="top-right" />
  </view>
  <view class="slot-wrapper">
    <slot />
  </view>
  <view wx:if="{{goodsCount > defaultShowNum && !showAll}}" class="more-mask" catchtap="onShowMoreTap">
    展开商品信息（共 {{goodsCount}} 个）
    <t-icon name="chevron-down" size="32rpx" />
  </view>
  <slot name="more" />
</view>
</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-image": "/components/webp-image/index",
    "t-icon": "tdesign-miniprogram/icon/icon"
  }
}</json>
