<script setup lang="ts">
const rows = [
  { label: 'alpha' },
  { label: 'beta' },
]
</script>

<template>
  <view class="issue558-list-scoped-cell">
    <slot
      v-for="(item, index) in rows"
      :key="item.label"
      :item="item"
      :index="index"
    />
  </view>
</template>

<style scoped>
.issue558-list-scoped-cell {
  padding: 20rpx;
  margin-top: 18rpx;
  background: #eff6ff;
  border: 1rpx solid #93c5fd;
}
</style>
