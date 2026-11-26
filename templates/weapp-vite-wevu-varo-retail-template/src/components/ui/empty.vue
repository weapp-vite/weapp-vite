<script setup lang="ts">
import { computed } from 'wevu'
import VIcon from './v-icon.vue'
import VImage from './v-image.vue'

const props = withDefaults(
  defineProps<{
    description?: string
    icon?: string
    image?: string
    size?: 'sm' | 'md' | 'lg'
    title?: string
  }>(),
  {
    description: '暂无数据',
    icon: 'info',
    image: '',
    size: 'md',
    title: '',
  },
)
const iconSize = computed(() => {
  if (props.size === 'lg') {
    return 44
  }
  if (props.size === 'sm') {
    return 28
  }
  return 36
})
</script>

<template>
  <view class="varo-empty" role="status" :data-size="size">
    <view class="varo-empty__visual">
      <slot name="image">
        <view style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%" aria-hidden="true">
          <VImage v-if="image" :src="image" width="100%" height="100%" fit="contain" />
          <VIcon v-else :name="icon" :size="iconSize" />
        </view>
      </slot>
    </view>
    <text v-if="title || $slots.title" class="varo-empty__title">
      <slot name="title">
        {{ title }}
      </slot>
    </text>
    <text class="varo-empty__description">
      <slot name="description">
        {{ description }}
      </slot>
    </text>
    <view v-if="$slots.default" class="varo-empty__action">
      <slot />
    </view>
  </view>
</template>

<json lang="jsonc">
{
  "component": true,
  "styleIsolation": "apply-shared"
}
</json>
