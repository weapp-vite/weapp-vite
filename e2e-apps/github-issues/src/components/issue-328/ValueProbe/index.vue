<script setup lang="ts">
import { computed, ref, watch } from 'wevu'

const props = withDefaults(defineProps<{
  value: string
}>(), {
  value: '0.00',
})

const valueHistory = ref<string[]>([])

watch(
  () => props.value as string | null | undefined,
  (next) => {
    if (next === null) {
      valueHistory.value.push('null')
      return
    }
    if (next === undefined) {
      valueHistory.value.push('undefined')
      return
    }
    valueHistory.value.push(next)
  },
  {
    immediate: true,
  },
)

const historyText = computed(() => valueHistory.value.join('|'))
</script>

<template>
  <view class="issue328-probe">
    <text
      class="issue328-value"
      :data-current-value="props.value"
    >
      {{ props.value }}
    </text>
    <text
      class="issue328-history"
      :data-history="historyText"
    >
      {{ historyText }}
    </text>
  </view>
</template>

<style scoped>
.issue328-probe {
  padding: 18rpx;
  margin-top: 18rpx;
  background: #fff;
  border: 2rpx solid #bfdbfe;
  border-radius: 16rpx;
}

.issue328-value,
.issue328-history {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #0f172a;
}

.issue328-value:first-child,
.issue328-history:first-child {
  margin-top: 0;
}
</style>
