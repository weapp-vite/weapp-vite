<script setup lang="ts">
import type { PropType } from 'vue'

interface PanelItem {
  id: number
  name: string
  desc: string
}

defineProps({
  items: {
    type: Array as PropType<PanelItem[]>,
    default: () => [],
  },
})

const emit = defineEmits<{
  (event: 'select', item: PanelItem): void
}>()
</script>

<template>
  <view class="panel">
    <view
      v-for="item in items"
      :key="item.id"
      class="panel-row"
      @tap="emit('select', item)"
    >
      <text class="name">
        {{ item.name }}
      </text>
      <text class="desc">
        {{ item.desc }}
      </text>
    </view>
  </view>
</template>

<style scoped>
.panel {
  background: #f7fafc;
  border-radius: 12rpx;
  padding: 14rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.panel-row {
  background: #ffffff;
  border-radius: 10rpx;
  padding: 12rpx;
  box-shadow: 0 6rpx 12rpx rgba(0, 0, 0, 0.04);
}

.name {
  font-size: 26rpx;
  color: #1a202c;
}

.desc {
  font-size: 22rpx;
  color: #4a5568;
}
</style>
