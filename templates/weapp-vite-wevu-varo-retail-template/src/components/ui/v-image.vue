<script setup lang="ts">
import type { ReactiveRuntime } from '@varo-ui/headless'
import { useImageRoot } from '@varo-ui/headless'
import { computed, shallowRef, watch } from 'wevu'

type ImageFit = 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'

// WeChat validates initial child bindings before Wevu applies setup defaults.
defineOptions({
  options: { virtualHost: true },
  properties: {
    alt: { type: null, value: '' },
    height: { type: null, value: null },
    radius: { type: null, value: null },
    src: { type: null, value: '' },
    width: { type: null, value: null },
  },
})

const props = withDefaults(
  defineProps<{
    alt?: string
    errorText?: string
    fit?: ImageFit
    height?: number | string
    lazyLoad?: boolean
    loadingText?: string
    radius?: number | string
    round?: boolean
    showError?: boolean
    showLoading?: boolean
    src?: string
    width?: number | string
  }>(),
  {
    alt: '',
    errorText: '',
    fit: 'fill',
    lazyLoad: false,
    loadingText: '',
    round: false,
    showError: true,
    showLoading: true,
    src: '',
  },
)
const emit = defineEmits<{
  error: [event: unknown]
  load: [event: unknown]
}>()
const MODE_BY_FIT = {
  'contain': 'aspectFit',
  'cover': 'aspectFill',
  'fill': 'scaleToFill',
  'none': 'center',
  'scale-down': 'aspectFit',
} as const satisfies Record<ImageFit, string>
const reactiveRuntime: ReactiveRuntime = {
  ref: shallowRef,
  computed,
}

const source = computed(() => props.src || '')
const imageAlt = computed(() => props.alt || '')
const image = useImageRoot({ runtime: reactiveRuntime, src: source })
const failed = computed(() => image.state.failed.value)
const hasSource = computed(() => image.state.hasSource.value)
const loading = computed(() => image.state.loading.value)
const dimension = (value: number | string | undefined) => (typeof value === 'number' ? `${value}px` : value)
const rootStyle = computed(() => ({
  borderRadius: props.round ? '999px' : dimension(props.radius),
  height: dimension(props.height),
  width: dimension(props.width),
}))

watch(() => props.src, image.api.reset)

function load(event: unknown) {
  image.events.load()
  emit('load', event)
}

function error(event: unknown) {
  image.events.error()
  emit('error', event)
}
</script>

<template>
  <view class="varo-image" :style="rootStyle" :data-error="String(failed)" :data-loaded="String(!loading)">
    <image
      v-if="hasSource && !failed"
      class="varo-image__img"
      :src="source"
      :mode="MODE_BY_FIT[props.fit]"
      :lazy-load="props.lazyLoad"
      :aria-label="imageAlt"
      @load="load"
      @error="error"
    />
    <view v-if="hasSource && loading && props.showLoading" class="varo-image__placeholder varo-image__loading">
      <slot name="loading">
        {{ props.loadingText }}
      </slot>
    </view>
    <view v-if="(!hasSource || failed) && props.showError" class="varo-image__placeholder varo-image__error">
      <slot name="error">
        {{ props.errorText }}
      </slot>
    </view>
  </view>
</template>

<json lang="jsonc">
{
  "component": true,
  "styleIsolation": "apply-shared"
}
</json>
