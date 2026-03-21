<script setup lang="ts">
// pages/goods/comments/components/comments-card/images-videos/index.js
defineOptions({
  /**
   * 组件的属性列表
   */
  properties: {
    resources: {
      type: Array,
      value: [],
    },
  },
  data() {
    return {
      classType: 'single',
    }
  },
  observers: {
    resources(newVal) {
      if (newVal.length <= 1) {
        this.setData({
          classType: 'single',
        })
      }
      else if (newVal.length === 2) {
        this.setData({
          classType: 'double',
        })
      }
      else {
        this.setData({
          classType: 'multiple',
        })
      }
    },
  },
  /**
   * 组件的方法列表
   */
  methods: {},
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
      v-for="(resource, index) in resources"
      :key="resource"
      :class="`resource-container resource-container-${classType} [display:flex]`"
    >
      <t-image v-if="resource.type === 'image'" :t-class="`resource-item-${classType}`" :src="resource.src" />
      <my-video v-else :videoSrc="resource.src" :my-video="`resource-item-${classType}`">
        <template #cover-img>
          <t-image :t-class="`resource-item resource-item-${classType}`":src="resource.coverSrc" />
        </template>
        <template #play-icon>
          <image class="play-icon [width:96rpx] [height:96rpx]"src="./assets/play.png" />
        </template>
      </my-video>
    </view>
  </view>
</template>
