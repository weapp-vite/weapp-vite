<script setup lang="ts">
import { computed } from 'wevu'

const { x: y = 'issue-600-default' } = defineProps<{
  x?: string
}>()
const setupValue = 'issue-600-setup'
const aliasTone = computed(() => (y === 'issue-600-alias' ? 'alias-ready' : 'alias-fallback'))
const setupTone = computed(() => (setupValue === 'issue-600-setup' ? 'setup-ready' : 'setup-fallback'))
const summary = computed(() => `${y}|${setupValue}|${aliasTone.value}|${setupTone.value}`)

definePageJson({
  navigationBarTitleText: 'issue-600',
})

function _runE2E() {
  return {
    ok: (y === 'issue-600-alias' || y === 'issue-600-default') && setupValue === 'issue-600-setup',
    setupValue,
    y,
    aliasTone: aliasTone.value,
    setupTone: setupTone.value,
    summary: summary.value,
  }
}
</script>

<template>
  <view class="issue600-page">
    <view
      class="issue600-probe"
      :class="[
        aliasTone,
        {
          [y]: y,
          'issue600-probe--setup': setupValue === 'issue-600-setup',
          'issue600-probe--ready': y === 'issue-600-alias' && setupValue === 'issue-600-setup',
        },
      ]"
      :style="[
        { color: y === 'issue-600-alias' ? '#1677ff' : '#475569' },
        { fontSize: setupValue === 'issue-600-setup' ? '32rpx' : '28rpx' },
      ]"
      :data-issue600-value="y"
      :data-issue600-summary="summary"
    >
      <text class="issue600-probe-value">
        {{ y }}
      </text>
      <text class="issue600-probe-summary">
        {{ summary }}
      </text>
    </view>
    <view
      class="issue600-setup-probe"
      :class="{
        [setupValue]: setupValue,
        'issue600-setup-probe--ready': setupTone === 'setup-ready',
      }"
      :data-issue600-setup-token="setupValue"
      :data-issue600-setup-value="setupValue"
    >
      {{ setupValue }}
    </view>
    <view
      v-if="y === 'issue-600-alias' && setupValue === 'issue-600-setup'"
      class="issue600-guard issue600-guard--if"
    >
      guard-if
    </view>
    <view
      v-else
      class="issue600-guard issue600-guard--else"
    >
      guard-else
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
