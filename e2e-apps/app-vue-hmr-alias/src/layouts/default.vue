<script setup lang="ts">
defineComponentJson({
  component: true,
})
</script>

<template>
  <view class="app-vue-hmr-alias-layout">
    <text class="app-vue-hmr-alias-layout__marker">
      APP-VUE-HMR-ALIAS-LAYOUT-BASE
    </text>
    <slot />
  </view>
</template>

<style>
.app-vue-hmr-alias-layout {
  min-height: 100vh;
  padding: 24rpx;
}

.app-vue-hmr-alias-layout__marker {
  display: block;
  margin-bottom: 16rpx;
  font-size: 24rpx;
  color: #0f172a;
}
</style>
