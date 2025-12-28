<script setup lang="ts">
import { computed, ref } from 'vue'

interface SlotItem {
  id: string
  label: string
  detail: string
}

const props = withDefaults(
  defineProps<{
    items?: SlotItem[]
    defaultHeader?: string
    defaultFooter?: string
  }>(),
  {
    items: () => [
      { id: 'alpha', label: 'Alpha', detail: '默认作用域插槽数据 A' },
      { id: 'beta', label: 'Beta', detail: '默认作用域插槽数据 B' },
    ],
    defaultHeader: '默认标题',
    defaultFooter: '使用默认 footer：切换展开',
  },
)

const expanded = ref(false)
const slotItems = computed(() => props.items)

function toggle() {
  expanded.value = !expanded.value
}
</script>

<template>
  <view class="shell">
    <view class="shell-header">
      <slot name="header">
        {{ props.defaultHeader }}
      </slot>
    </view>

    <view class="shell-body">
      <slot :expanded="expanded" :items="slotItems" :toggle="toggle">
        <text class="placeholder">
          默认正文内容
        </text>
      </slot>
    </view>

    <view class="shell-footer">
      <slot name="footer">
        <button size="mini" @tap="toggle">
          {{ props.defaultFooter }}
        </button>
      </slot>
    </view>
  </view>
</template>

<style scoped>
.shell {
  border: 1rpx dashed #cbd5e0;
  border-radius: 12rpx;
  padding: 16rpx;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.shell-header,
.shell-footer {
  color: #2d3748;
  font-size: 24rpx;
}

.shell-body {
  background: #ffffff;
  border-radius: 8rpx;
  padding: 12rpx;
}

.placeholder {
  color: #a0aec0;
  font-size: 22rpx;
}
</style>
