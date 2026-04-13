<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  fooBar: string
}>()

function snapshot() {
  return {
    visible: props.visible,
    fooBar: props.fooBar,
    summary: `${props.visible ? 'visible' : 'hidden'}:${props.fooBar}`,
  }
}

defineExpose({
  snapshot,
})
</script>

<template>
  <view class="issue446-probe">
    <text class="issue446-probe__visible">
      {{ props.visible ? 'visible' : 'hidden' }}
    </text>
    <text class="issue446-probe__foo">
      {{ props.fooBar }}
    </text>
  </view>
</template>

<style scoped>
.issue446-probe {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 20rpx;
  margin-top: 20rpx;
  background: #e0f2fe;
  border-radius: 16rpx;
}

.issue446-probe__visible,
.issue446-probe__foo {
  font-size: 24rpx;
  color: #0f172a;
}
</style>
