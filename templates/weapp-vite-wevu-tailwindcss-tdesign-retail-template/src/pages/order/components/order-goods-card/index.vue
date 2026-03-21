<script setup lang="ts">
// @ts-nocheck
defineOptions({
  options: {
    addGlobalClass: true,
    multipleSlots: true, // 在组件定义时的选项中启用多slot支持
  },
  relations: {
    '../order-card/index': {
      type: 'ancestor',
      linked(target) {
        this.parent = target
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
  data() {
    return {
      hidden: false,
    }
  },
  methods: {
    setHidden(hidden) {
      if (this.data.hidden === hidden) { return }
      this.setData({
        hidden,
      })
    },
    onNumChange(e) {
      const {
        value,
      } = e.detail
      this.triggerEvent('num-change', {
        value,
      })
    },
  },
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-stepper': 'tdesign-miniprogram/stepper/stepper',
    'goods-card': '../specs-goods-card/index',
  },
})
</script>

<template>
  <goods-card
    v-if="!hidden"
    :class="`order-goods-card ${step ? 'order-goods-card--step' : ''}`"
    :data="goods"
    :thumb-width="thumbWidth"
    :thumb-height="thumbHeight"
    :thumb-width-in-popup="thumbWidthInPopup"
    :thumb-height-in-popup="thumbHeightInPopup"
  >
    <template #append-body>
      <t-stepper
        v-if="step"

        :disabled="step ? stepDisabled : ''"
        :value="goods.quantity"
        :min="1"
        theme="filled"
        @minus="onNumChange"
        @plus="onNumChange"
        @blur="onNumChange"
      />
    </template>
    <!-- 透传good-card组件的slot -->
    <slot name="thumb-cover" />
    <slot name="after-title" />
    <slot name="after-desc" />
    <slot name="price-prefix" />
    <slot name="append-body" />
    <slot name="footer" />
    <slot name="append-card" />
  </goods-card>
</template>
