<script setup lang="ts">
import { usePageFeedbackHost } from 'wevu'

usePageFeedbackHost(['#t-toast', '#t-dialog'])

defineComponentJson({
  component: true,
  usingComponents: {
    't-dialog': 'tdesign-miniprogram/dialog/dialog',
    't-toast': 'tdesign-miniprogram/toast/toast',
  },
})
</script>

<template>
  <view class="layout-default">
    <slot />
    <t-toast id="t-toast" />
    <t-dialog id="t-dialog" />
  </view>
</template>

<style>
.layout-default {
  min-height: 100%;
}
</style>
