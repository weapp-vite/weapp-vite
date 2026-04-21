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
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 14rpx;
  background: #f7fafc;
  border-radius: 12rpx;
}

.panel-row {
  padding: 12rpx;
  background: #fff;
  border-radius: 10rpx;
  box-shadow: 0 6rpx 12rpx rgb(0 0 0 / 4%);
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
