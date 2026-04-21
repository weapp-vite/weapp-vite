<script setup lang="ts">
import { toRefs } from 'wevu'

defineOptions({
  setupLifecycle: 'created',
  externalClasses: ['wr-class'],
})

const props = withDefaults(defineProps<{
  position?: string
  noMask?: boolean
  type?: string
  vertical?: boolean
  size?: string
  backgroundColor?: string
}>(), {
  position: 'static',
  noMask: false,
  type: 'circular',
  vertical: false,
  size: '50rpx',
  backgroundColor: 'rgba(0, 0, 0, .6)',
})

const { position, noMask, type, vertical, size, backgroundColor } = toRefs(props)

defineExpose({
  position,
  noMask,
  type,
  vertical,
  size,
  backgroundColor,
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-loading': 'tdesign-miniprogram/loading/loading',
  },
})
</script>

<template>
  <view :class="`t-class loading-content ${position} ${(position === 'static' || noMask) ? 'invisible' : ''} size-full bg-[rgba(0,0,0,0.6)] relative [&_.absolute]:absolute [&_.absolute]:z-1 [&_.absolute]:left-0 [&_.absolute]:top-0 [&_.fixed]:fixed [&_.fixed]:z-1 [&_.fixed]:left-0 [&_.fixed]:top-0 [&_.loading]:size-full [&_.loading]:visible`" :style="`background-color: ${backgroundColor};`">
    <t-loading
      t-class="loading"
      :theme="type"
      :layout="vertical"
      :size="size"
    >
      <slot />
    </t-loading>
  </view>
</template>
