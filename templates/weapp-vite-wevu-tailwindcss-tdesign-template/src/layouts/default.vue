<script setup lang="ts">
import type { DialogHostInstance, ToastHostInstance } from '@/hooks/useLayoutFeedbackBridge'
import { useTemplateRef } from 'wevu'
import { useLayoutFeedbackBridge } from '@/hooks/useLayoutFeedbackBridge'

const toastHost = useTemplateRef<ToastHostInstance>('toastHost')
const dialogHost = useTemplateRef<DialogHostInstance>('dialogHost')

useLayoutFeedbackBridge({
  toast: toastHost,
  dialog: dialogHost,
})

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
    <t-toast ref="toastHost" />
    <t-dialog ref="dialogHost" />
  </view>
</template>

<style>
.layout-default {
  min-height: 100%;
}
</style>
