<script setup>
import { useAttrs } from 'vue'

const label = 'script-setup-only'
const attrs = useAttrs()
const extraText = attrs.extra ?? ''
</script>

<template>
  <view class="root">
    {{ label }} {{ extraText }}
  </view>
</template>

<style>
.root {
  color: #3b82f6;
}
</style>
