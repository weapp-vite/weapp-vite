<script setup lang="ts">
import { readMetrics as readRuntimeMetrics } from '../../runtime/metrics'

function readMetrics() {
  return readRuntimeMetrics()
}
defineExpose({ readMetrics })
</script>

<template>
  <view>已离开售后页面</view>
</template>
