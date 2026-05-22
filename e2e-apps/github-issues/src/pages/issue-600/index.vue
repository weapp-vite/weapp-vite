<script setup lang="ts">
const { x: y } = defineProps<{
  x: string
}>()

definePageJson({
  navigationBarTitleText: 'issue-600',
})

function _runE2E() {
  return {
    ok: y === 'issue-600-alias',
    y,
  }
}
</script>

<template>
  <view class="issue600-page">
    <view
      class="issue600-probe"
      :class="{ [y]: y }"
      :data-issue600-value="y"
    >
      {{ y }}
    </view>
  </view>
</template>

<style scoped>
.issue600-page {
  min-height: 100vh;
  padding: 32rpx;
  background: #f8fafc;
}

.issue600-probe {
  min-height: 48rpx;
  line-height: 48rpx;
  color: #0f172a;
}
</style>
