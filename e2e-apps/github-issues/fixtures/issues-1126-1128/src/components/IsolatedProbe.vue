<script setup lang="ts">
defineOptions({ options: { styleIsolation: 'isolated' } })
defineComponentJson({ component: true })
</script>

<template>
  <view class="global-probe">isolated</view>
  <view class="theme-probe">Theme</view>
</template>

<style>
.theme-probe { color: var(--issue-theme); }
</style>
