<script setup lang="ts">
const props = defineProps({
  value: {
    type: null,
    value: null,
  },
  label: {
    type: String,
    value: '',
  },
})

const displayValue = props.value ?? 'zero'

defineComponentJson({
  component: true,
})
</script>

<template>
  <view class="issue521-flex-item" :data-label="label" :data-value="displayValue">
    {{ label }}: {{ displayValue }}
  </view>
</template>

<style scoped>
.issue521-flex-item {
  box-sizing: border-box;
  width: 120rpx;
  min-height: 64rpx;
  padding: 12rpx 0;
  font-size: 22rpx;
  line-height: 24rpx;
  color: #111827;
  text-align: center;
  background: #a7f3d0;
  border: 2rpx solid #047857;
  border-radius: 8rpx;
}
</style>
