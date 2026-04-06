<script setup lang="ts">
import { computed } from 'wevu'

interface CommentResource {
  type?: 'image' | 'video' | string
  src?: string
  coverSrc?: string
}

const props = withDefaults(defineProps<{
  resources?: CommentResource[]
}>(), {
  resources: () => [],
})

const classType = computed(() => {
  if (props.resources.length <= 1) {
    return 'single'
  }
  if (props.resources.length === 2) {
    return 'double'
  }
  return 'multiple'
})

defineExpose({
  classType,
})

defineComponentJson({
  component: true,
  usingComponents: {
    'my-video': '../my-video/index',
    't-image': '/components/webp-image/index',
  },
})
</script>

<template>
  <view :class="`images-videos-container container-${classType} [display:flex] [flex-wrap:wrap]`">
    <view
      v-for="resource in resources"
      :key="resource.src"
      :class="`resource-container resource-container-${classType} [display:flex]`"
    >
      <t-image v-if="resource.type === 'image'" :t-class="`resource-item-${classType}`" :src="resource.src" />
      <my-video v-else :videoSrc="resource.src" :my-video="`resource-item-${classType}`">
        <template #cover-img>
          <t-image :t-class="`resource-item resource-item-${classType}`" :src="resource.coverSrc" />
        </template>
        <template #play-icon>
          <image class="play-icon [width:96rpx] [height:96rpx]" src="./assets/play.png" />
        </template>
      </my-video>
    </view>
  </view>
</template>
