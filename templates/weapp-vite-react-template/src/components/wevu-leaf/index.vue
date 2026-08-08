<script setup lang="ts">
const props = defineProps<{
  label: string
  value: number
}>()

const emit = defineEmits<{
  change: [detail: { value: number }]
}>()

defineComponentJson({
  options: {
    multipleSlots: true,
  },
})

function emitChange() {
  emit('change', {
    value: Number(props.value ?? 0) + 1,
  })
}
</script>

<template>
  <view class="leaf">
    <text class="label">
      {{ label }}：{{ value }}
    </text>
    <slot />
    <button id="wevu-action" size="mini" @tap="emitChange">
      Wevu +1
    </button>
  </view>
</template>

<style>
.leaf {
  padding: 20rpx;
  margin-bottom: 20rpx;
  background: #fff;
  border: 1rpx solid #7b8794;
}

.label {
  display: block;
  font-weight: 600;
}
</style>
