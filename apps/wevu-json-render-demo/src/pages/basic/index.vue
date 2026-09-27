<script setup lang="ts">
import { defineRendererCatalog, standardComponents, useJsonRenderer } from '@wevu/json-render'

const renderer = useJsonRenderer({
  catalog: defineRendererCatalog({ components: standardComponents, actions: {} }),
  spec: { root: 'label', elements: { label: { type: 'Text', props: { text: { $state: '/message' } } } } },
  initialState: { message: '基础组件无需业务适配' },
  actions: {},
})
const tree = renderer.tree
</script>

<template>
  <view>
    <json-renderer v-if="tree" :node="tree" />
  </view>
</template>
