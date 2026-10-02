<script setup lang="ts">
defineOptions({ options: { styleIsolation: 'apply-shared' } })
defineComponentJson({ component: true })
</script>

<template>
  <view class="global-probe">apply-shared</view>
  <view class="theme-probe">Theme</view>
</template>

<style>
.theme-probe { color: var(--issue-theme); }
</style>
