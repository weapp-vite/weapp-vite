<script setup lang="ts">
const props = defineProps<{
  label: string
  value: number
}>()

const emit = defineEmits<{
  change: [detail: { source: string, value: number }]
}>()

defineComponentJson({
  options: {
    multipleSlots: true,
  },
})

function emitChange() {
  emit('change', {
    source: 'wevu-leaf',
    value: Number(props.value ?? 0) + 1,
  })
}
</script>

<template>
  <view class="leaf" data-e2e-leaf="wevu">
    <text class="leaf-label">{{ label }}:{{ value }}</text>
    <slot />
    <button id="wevu-leaf-action" size="mini" @tap="emitChange">
      wevu +1
    </button>
  </view>
</template>

<style>
.leaf {
  padding: 12rpx;
  margin: 10rpx 0;
  border: 1rpx solid #7b8794;
}

.leaf-label {
  display: block;
  font-weight: 600;
}
</style>
