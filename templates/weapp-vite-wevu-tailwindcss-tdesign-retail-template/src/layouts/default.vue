<script setup lang="ts">
import type { DialogHostInstance, ToastHostInstance } from '@/hooks/useLayoutFeedbackBridge'
import { useLayoutHosts, useTemplateRef } from 'wevu'
import { LAYOUT_DIALOG_BRIDGE_KEY, LAYOUT_TOAST_BRIDGE_KEY } from '@/hooks/useLayoutFeedbackBridge'

const toastHost = useTemplateRef<ToastHostInstance>('toastHost')
const dialogHost = useTemplateRef<DialogHostInstance>('dialogHost')

useLayoutHosts({
  [LAYOUT_TOAST_BRIDGE_KEY]: toastHost,
  [LAYOUT_DIALOG_BRIDGE_KEY]: dialogHost,
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
