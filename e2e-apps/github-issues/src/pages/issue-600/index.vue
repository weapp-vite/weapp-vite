<script setup lang="ts">
const { x: y = 'ppp' } = defineProps<{
  x?: string
}>()
const x = 'issue-600-setup'

definePageJson({
  navigationBarTitleText: 'issue-600',
})

function _runE2E() {
  return {
    ok: y === 'issue-600-alias' && x === 'issue-600-setup',
    x,
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
    <view
      class="issue600-setup-probe"
      :class="{ [x]: x }"
      :data-issue600-setup-value="x"
    >
      {{ x }}
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
