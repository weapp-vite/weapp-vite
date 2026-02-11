<script setup lang="ts">
import { useAttrs } from 'wevu'

defineProps<{
  root: {
    a: string
  }
}>()

const attrs = useAttrs()
</script>

<template>
  <view id="info-banner">
    {{ root.a }}-{{ attrs.extra?.tag || '' }}
  </view>
</template>
