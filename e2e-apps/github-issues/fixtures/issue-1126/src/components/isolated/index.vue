<script setup lang="ts">
defineOptions({ options: { styleIsolation: 'isolated', addGlobalClass: true } })
defineComponentJson({ component: true })
</script>

<template>
  <view id="box" class="app-box">isolated</view>
  <view id="theme" class="theme-probe">Theme</view>
</template>

<style>
.theme-probe {
  color: var(--probe-theme, rgb(0 0 0));
}
</style>
