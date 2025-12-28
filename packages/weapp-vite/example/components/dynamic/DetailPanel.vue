<script setup lang="ts">
import type { PropType } from 'vue'

interface PanelItem {
  id: number
  name: string
  desc: string
}

defineProps({
  item: {
    type: Object as PropType<PanelItem>,
    required: true,
  },
})

const emit = defineEmits<{
  (event: 'back'): void
}>()
</script>

<template>
  <view class="panel">
    <text class="name">
      {{ item.name }}
    </text>
    <text class="desc">
      {{ item.desc }}
    </text>
    <button size="mini" type="primary" @tap="emit('back')">
      返回列表
    </button>
  </view>
</template>

<style scoped>
.panel {
  background: #f0fff4;
  border-radius: 12rpx;
  padding: 14rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  border: 1rpx solid #9ae6b4;
}

.name {
  font-size: 28rpx;
  color: #22543d;
}

.desc {
  font-size: 24rpx;
  color: #2f855a;
}
</style>
