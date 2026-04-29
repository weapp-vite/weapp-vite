<script setup lang="ts">
definePageJson({
  navigationBarTitleText: 'issue-520',
})
</script>

<template>
  <view class="issue520-page">
    <Issue520ResolverSlotCard>
      <template #header>
        <text data-issue520-slot="header">
          issue-520 resolver slot header
        </text>
      </template>
      <text data-issue520-slot="default">
        issue-520 resolver slot default
      </text>
    </Issue520ResolverSlotCard>
  </view>
</template>

<style>
.issue520-page {
  padding: 24rpx;
}
</style>
