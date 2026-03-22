<script setup lang="ts">
import type { DialogHostInstance, ToastHostInstance } from '@/hooks/useLayoutFeedbackBridge'
import { useLayoutHosts, useTemplateRef } from 'wevu'
import { LAYOUT_DIALOG_BRIDGE_KEY, LAYOUT_TOAST_BRIDGE_KEY } from '@/hooks/useLayoutFeedbackBridge'

const props = defineProps<{
  subtitle?: string
  title?: string
}>()

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
  <view class="layout-admin min-h-full bg-[linear-gradient(180deg,#f8f7ff_0%,#f1efff_100%)]">
    <view class="rounded-b-[32rpx] bg-[linear-gradient(145deg,#2f2b5f_0%,#4b3fb8_64%,#8b7bff_100%)] px-[32rpx] pb-[32rpx] pt-[36rpx] text-white shadow-[0_18rpx_42rpx_rgba(75,63,184,0.18)]">
      <text class="inline-flex rounded-full bg-white/15 px-[16rpx] py-[8rpx] text-[22rpx]">
        layouts/admin.vue
      </text>
      <text class="mt-[18rpx] block text-[46rpx] font-semibold">
        {{ props.title || 'Admin Layout' }}
      </text>
      <text class="mt-[12rpx] block text-[24rpx] leading-[1.7] text-white/90">
        {{ props.subtitle || '页面内容通过默认 slot 注入到布局中。' }}
      </text>
    </view>
    <view class="pb-[32rpx]">
      <slot />
    </view>
    <t-toast ref="toastHost" />
    <t-dialog ref="dialogHost" />
  </view>
</template>

<style>
.layout-admin {
  min-height: 100%;
}
</style>
