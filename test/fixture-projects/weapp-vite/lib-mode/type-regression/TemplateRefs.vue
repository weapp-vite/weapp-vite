<script setup lang="ts">
import { useTemplateRef } from 'wevu'
import Child from './Child.vue'

const viewRef = useTemplateRef('viewRef')
const mapRef = useTemplateRef('mapRef')
const repeatedRef = useTemplateRef('repeatedRef')
const childRef = useTemplateRef('childRef')
const explicitRef = useTemplateRef<{ code: number }>('manualRef')

defineExpose({ viewRef, mapRef, repeatedRef, childRef, explicitRef })
</script>

<template>
  <view ref="viewRef" />
  <map ref="mapRef" />
  <view v-for="index in 2" :key="index" ref="repeatedRef" />
  <Child ref="childRef" />
</template>
