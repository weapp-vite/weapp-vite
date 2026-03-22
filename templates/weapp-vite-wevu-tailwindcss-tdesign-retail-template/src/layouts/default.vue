<script setup lang="ts">
import { getCurrentInstance, useLayoutBridge, useTemplateRef } from 'wevu'

const toastHost = useTemplateRef<any>('toastHost')
const dialogHost = useTemplateRef<any>('dialogHost')
const layoutInstance = getCurrentInstance<any>()

function resolveBridgeHost(host: any, fallbackSelector: string) {
  return layoutInstance?.selectComponent?.(fallbackSelector) ?? host ?? null
}

useLayoutBridge(['#t-toast', '#t-dialog'], {
  resolveComponent(selector) {
    if (selector === '#t-toast') {
      return resolveBridgeHost(toastHost.value, '#t-toast')
    }
    if (selector === '#t-dialog') {
      return resolveBridgeHost(dialogHost.value, '#t-dialog')
    }
    return null
  },
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
    <t-toast id="t-toast" ref="toastHost" />
    <t-dialog id="t-dialog" ref="dialogHost" />
  </view>
</template>

<style>
.layout-default {
  min-height: 100%;
}
</style>
