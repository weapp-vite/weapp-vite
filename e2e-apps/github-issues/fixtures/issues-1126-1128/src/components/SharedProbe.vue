<script setup lang="ts">
defineOptions({ options: { styleIsolation: 'shared' } })
defineComponentJson({ component: true })
</script>

<template>
  <view class="global-probe">shared</view>
  <view class="theme-probe">Theme</view>
</template>

<style>
.theme-probe { color: var(--issue-theme); }
</style>
