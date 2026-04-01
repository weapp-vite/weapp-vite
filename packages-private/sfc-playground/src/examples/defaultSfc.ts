export const defaultSfc = `<template>
  <view class="page">
    <view class="hero">{{ title }}</view>
    <view class="subtitle">{{ subtitle }}</view>
    <view wx:if="{{ items.length }}" class="list">
      <view
        v-for="item in items"
        :key="item.id"
        class="card"
      >
        {{ item.label }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const title = 'wevu SFC playground'
const count = ref(2)

const subtitle = computed(() => \`compiled from Vue SFC, count = \${count.value}\`)

const items = computed(() => Array.from({ length: count.value }, (_, index) => ({
  id: index + 1,
  label: \`Card #\${index + 1}\`,
})))
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 32rpx;
}

.hero {
  font-size: 40rpx;
  font-weight: 700;
}

.subtitle {
  color: #57606a;
}

.list {
  display: grid;
  gap: 12rpx;
}

.card {
  padding: 20rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #f4f0e8, #e6eef8);
}
</style>

<json lang="json">
{
  "navigationBarTitleText": "wevu playground"
}
</json>
`
