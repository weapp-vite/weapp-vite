<script setup lang="ts">
definePageMeta({
  navigationBarTitleText: 'issue-494',
})

const iconSrc = 'https://static.example.com/issue-494/icon.png'
</script>

<template>
  <Issue494IconHost>
    <template #icon>
      <img class="issue494-icon" :src="iconSrc" mode="aspectFit">
    </template>

    <template #content>
      <view class="issue494-title">
        issue-494 template slot single root no wrapper
      </view>
      <view class="issue494-desc">
        multi root fallback keeps wrapper
      </view>
    </template>
  </Issue494IconHost>
</template>

<style scoped>
.issue494-icon {
  width: 80rpx;
  height: 80rpx;
}

.issue494-title {
  font-size: 32rpx;
  font-weight: 600;
}

.issue494-desc {
  color: #475569;
  font-size: 24rpx;
}
</style>
