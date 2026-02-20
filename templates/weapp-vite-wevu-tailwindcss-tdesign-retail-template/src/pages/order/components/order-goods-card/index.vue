<script lang="ts">
Component({
  options: {
    addGlobalClass: true,
    multipleSlots: true, // 在组件定义时的选项中启用多slot支持
  },

  relations: {
    '../order-card/index': {
      type: 'ancestor',
      linked(target) {
        this.parent = target;
      },
    },
  },

  properties: {
    goods: Object,
    thumbWidth: Number,
    thumbHeight: Number,
    thumbWidthInPopup: Number,
    thumbHeightInPopup: Number,
    noTopLine: Boolean,
    step: Boolean,
    stepDisabled: Boolean,
  },

  data: {
    goods: {},
    hidden: false,
  },

  methods: {
    setHidden(hidden) {
      if (this.data.hidden === hidden) return;
      this.setData({ hidden });
    },

    onNumChange(e) {
      const { value } = e.detail;
      this.triggerEvent('num-change', { value });
    },
  },
});
</script>

<template>
<goods-card
  class="order-goods-card {{ step ? 'order-goods-card--step' : '' }}"
  wx:if="{{!hidden}}"
  data="{{goods}}"
  thumb-width="{{thumbWidth}}"
  thumb-height="{{thumbHeight}}"
  thumb-width-in-popup="{{thumbWidthInPopup}}"
  thumb-height-in-popup="{{thumbHeightInPopup}}"
>
  <t-stepper
    wx:if="{{ step }}"
    slot="append-body"
    disabled="{{ step ? stepDisabled : ''}}"
    value="{{goods.quantity}}"
    min="{{ 1 }}"
    theme="filled"
    bindminus="onNumChange"
    bindplus="onNumChange"
    bindblur="onNumChange"
  />
  <!-- 透传good-card组件的slot -->
  <slot name="thumb-cover" slot="thumb-cover" />
  <slot name="after-title" slot="after-title" />
  <slot name="after-desc" slot="after-desc" />
  <slot name="price-prefix" slot="price-prefix" />
  <slot name="append-body" slot="append-body" />
  <slot name="footer" slot="footer" />
  <slot name="append-card" slot="append-card" />
</goods-card>
</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-stepper": "tdesign-miniprogram/stepper/stepper",
    "goods-card": "../specs-goods-card/index"
  }
}</json>
