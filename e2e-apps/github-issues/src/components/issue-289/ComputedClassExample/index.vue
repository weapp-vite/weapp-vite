<script setup lang="ts">
import { computed } from 'wevu'

const props = defineProps<{
  sourceEnabled: boolean
  showItems: boolean
  selectedIndex: number
}>()

const items = [
  {
    id: 'computed-0',
    label: '计算类名 a',
    preferred: true,
  },
  {
    id: 'computed-1',
    label: '计算类名 b',
    preferred: false,
  },
  {
    id: 'computed-2',
    label: '计算类名混合',
    preferred: true,
  },
]

const computedValue = computed(() => Boolean(props.sourceEnabled))

const safeSelectedIndex = computed(() => {
  if (props.selectedIndex < 0) {
    return 0
  }
  if (props.selectedIndex >= items.length) {
    return items.length - 1
  }
  return props.selectedIndex
})

const computedListClass = computed(() => [
  'computed-list',
  computedValue.value ? 'computed-list-enabled' : 'computed-list-disabled',
])
</script>

<template>
  <view class="computed-class-box">
    <view id="issue289-computed-main" :class="computedValue ? 'a' : 'b'">
      computed class: {{ computedValue ? 'a' : 'b' }}
    </view>

    <view v-if="showItems" :class="computedListClass">
      <view
        v-for="(item, index) in items"
        :key="item.id"
        class="computed-item"
        :class="[
          index === safeSelectedIndex ? 'computed-item-active' : 'computed-item-idle',
          item.preferred === computedValue ? 'computed-item-match' : 'computed-item-mismatch',
        ]"
      >
        {{ item.label }}
      </view>
    </view>

    <view v-else class="computed-empty" :class="computedValue ? 'computed-empty-a' : 'computed-empty-b'">
      computed list hidden
    </view>
  </view>
</template>

<style scoped>
.computed-class-box {
  margin-top: 20rpx;
}

.a,
.b {
  padding: 14rpx 20rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.a {
  color: #166534;
  background: #dcfce7;
}

.b {
  color: #9f1239;
  background: #ffe4e6;
}

.computed-list {
  margin-top: 12rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.computed-list-enabled {
  opacity: 1;
}

.computed-list-disabled {
  opacity: 0.76;
}

.computed-item {
  min-height: 52rpx;
  line-height: 52rpx;
  padding: 0 14rpx;
  border-radius: 9999rpx;
  font-size: 22rpx;
}

.computed-item-active {
  transform: scale(1.03);
}

.computed-item-idle {
  transform: scale(1);
}

.computed-item-match {
  color: #166534;
  background: #dcfce7;
}

.computed-item-mismatch {
  color: #9f1239;
  background: #ffe4e6;
}

.computed-empty {
  margin-top: 10rpx;
  padding: 10rpx 14rpx;
  border-radius: 12rpx;
  font-size: 22rpx;
}

.computed-empty-a {
  color: #166534;
  background: #dcfce7;
}

.computed-empty-b {
  color: #9f1239;
  background: #ffe4e6;
}
</style>
