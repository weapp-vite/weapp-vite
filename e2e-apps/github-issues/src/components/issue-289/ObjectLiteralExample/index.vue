<script setup lang="ts">
import { computed } from 'wevu'
import InfoBanner from '../InfoBanner/index.vue'

interface ObjectItem {
  id: string
  label: string
  tone: 'primary' | 'warning'
}

const props = defineProps<{
  showList: boolean
  compactMode: boolean
  activeId: string
}>()

const items: ObjectItem[] = [
  {
    id: 'item-0',
    label: '对象字面量入口',
    tone: 'primary',
  },
  {
    id: 'item-1',
    label: '类名绑定分支',
    tone: 'warning',
  },
  {
    id: 'item-2',
    label: '渲染安全兜底',
    tone: 'primary',
  },
]

const listClass = computed(() => [
  'object-list',
  props.compactMode ? 'object-list-compact' : 'object-list-loose',
])
</script>

<template>
  <view class="block">
    <InfoBanner :root="{ a: 'aaaa' }" />

    <view v-if="showList" id="issue289-object-list" :class="listClass">
      <view
        v-for="item in items"
        :key="item.id"
        class="object-item"
        :class="[
          activeId === item.id ? 'object-item-active' : 'object-item-idle',
          item.tone === 'primary' ? 'object-item-primary' : 'object-item-warning',
        ]"
      >
        <text>{{ item.label }}</text>
        <text
          v-if="activeId === item.id"
          class="object-item-badge"
          :class="item.tone === 'primary' ? 'object-item-badge-primary' : 'object-item-badge-warning'"
        >
          active
        </text>
      </view>
    </view>

    <view v-else id="issue289-object-empty" class="object-empty" :class="compactMode ? 'object-empty-compact' : 'object-empty-loose'">
      object list hidden
    </view>
  </view>
</template>

<style scoped>
.block {
  margin-top: 20rpx;
}

.object-list {
  margin-top: 12rpx;
  display: flex;
  flex-wrap: wrap;
}

.object-list-loose {
  gap: 12rpx;
}

.object-list-compact {
  gap: 8rpx;
}

.object-item {
  display: inline-flex;
  align-items: center;
  min-height: 54rpx;
  padding: 0 14rpx;
  border-radius: 9999rpx;
  font-size: 22rpx;
}

.object-item-idle {
  opacity: 0.8;
}

.object-item-active {
  opacity: 1;
}

.object-item-primary {
  color: #0f766e;
  background: #ccfbf1;
}

.object-item-warning {
  color: #9a3412;
  background: #ffedd5;
}

.object-item-badge {
  margin-left: 10rpx;
  padding: 2rpx 10rpx;
  border-radius: 9999rpx;
  font-size: 20rpx;
}

.object-item-badge-primary {
  color: #ffffff;
  background: #0f766e;
}

.object-item-badge-warning {
  color: #ffffff;
  background: #c2410c;
}

.object-empty {
  margin-top: 10rpx;
  padding: 10rpx 14rpx;
  border-radius: 12rpx;
  font-size: 22rpx;
  color: #475569;
  background: #f1f5f9;
}

.object-empty-loose {
  letter-spacing: 0;
}

.object-empty-compact {
  letter-spacing: 1rpx;
}
</style>
