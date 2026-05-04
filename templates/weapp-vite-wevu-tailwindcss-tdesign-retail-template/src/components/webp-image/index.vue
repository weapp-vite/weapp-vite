<script setup lang="ts">
import { onMounted, ref, toRefs, useBoundingClientRect } from 'wevu'
import { wpi } from 'wevu/api'
import { getSrc } from './utils'

defineOptions({
  setupLifecycle: 'created',
  externalClasses: ['t-class', 't-class-load'],
})

const props = withDefaults(defineProps<{
  loadFailed?: string
  loading?: string
  src?: string
  mode?: string
  webp?: boolean
  lazyLoad?: boolean
  showMenuByLongpress?: boolean
}>(), {
  loadFailed: 'default',
  loading: 'default',
  src: '',
  mode: 'aspectFill',
  webp: true,
  lazyLoad: false,
  showMenuByLongpress: false,
})

const emit = defineEmits<{
  load: [detail: any]
  error: [detail: any]
}>()

const thumbHeight = ref(375)
const thumbWidth = ref(375)
const systemInfo = ref(wpi.getSystemInfoSync())
const getBoundingClientRect = useBoundingClientRect()

const { loadFailed, loading, src, mode, webp, lazyLoad, showMenuByLongpress } = toRefs(props)

function px2rpx(px: number) {
  return 750 / ((systemInfo.value?.screenWidth) || 375) * px
}

function onLoad(e: any) {
  emit('load', e.detail)
}

function onError(e: any) {
  emit('error', e.detail)
}

onMounted(() => {
  getBoundingClientRect('.J-image').then((res) => {
    if (!res) {
      return
    }
    const { width, height } = res
    if (mode.value === 'heightFix') {
      thumbHeight.value = px2rpx(height) || 375
    }
    else {
      thumbWidth.value = px2rpx(width) || 375
    }
  })
})

defineExpose({
  loadFailed,
  loading,
  src,
  mode,
  webp,
  lazyLoad,
  showMenuByLongpress,
  thumbHeight,
  thumbWidth,
  systemInfo,
  onLoad,
  onError,
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-image': 'tdesign-miniprogram/image/image',
  },
})
</script>

<template>
  <t-image
    class="J-image"
    :src="getSrc({ src, thumbWidth: thumbWidth || 0, thumbHeight: thumbHeight || 0, systemInfo, webp, mode }) || ''"
    t-class="t-class"
    t-class-load="t-class-load"
    :mode="mode"
    :lazy="lazyLoad"
    :show-menu-by-longpress="showMenuByLongpress"
    :error="loadFailed"
    :loading="loading"
    @error="onError"
    @load="onLoad"
  />
</template>
