<script setup lang="ts">
defineOptions({ options: { styleIsolation: 'apply-shared' } })
defineComponentJson({ component: true })
</script>

<template>
  <view id="box" class="app-box">applyShared</view>
  <view id="theme" class="theme-probe">Theme</view>
</template>

<style src="./index.css"></style>
