<script setup lang="ts">
import Issue674SlotProbe from '../../components/issue-674/SlotProbe/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-674',
})
definePageMeta({
  layout: false,
})
</script>

<template>
  <view class="issue674-page">
    <Issue674SlotProbe>
      <template #header>
        <text class="issue674-page__header">issue-674 header slot</text>
      </template>
      <text class="issue674-page__default">issue-674 default slot</text>
    </Issue674SlotProbe>
  </view>
</template>

<style scoped>
.issue674-page {
  min-height: 100vh;
  padding: 24rpx;
}
</style>
