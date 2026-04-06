<script setup lang="ts">
const props = withDefaults(defineProps<{
  goods?: Record<string, any>
  thumbWidth?: number
  thumbHeight?: number
  thumbWidthInPopup?: number
  thumbHeightInPopup?: number
  noTopLine?: boolean
  step?: boolean
  stepDisabled?: boolean
  hidden?: boolean
}>(), {
  goods: () => ({}),
  thumbWidth: undefined,
  thumbHeight: undefined,
  thumbWidthInPopup: undefined,
  thumbHeightInPopup: undefined,
  noTopLine: false,
  step: false,
  stepDisabled: false,
  hidden: false,
})

const emit = defineEmits<{
  'num-change': [payload: { value: number | string }]
}>()

function onNumChange(e: { detail?: { value?: number | string } }) {
  emit('num-change', {
    value: e.detail?.value ?? 0,
  })
}

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
    <slot name="thumb-cover" />
    <slot name="after-title" />
    <slot name="after-desc" />
    <slot name="price-prefix" />
    <slot name="append-body" />
    <slot name="footer" />
    <slot name="append-card" />
  </goods-card>
</template>
