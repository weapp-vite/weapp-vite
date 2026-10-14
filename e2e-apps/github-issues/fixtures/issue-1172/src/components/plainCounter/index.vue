<script setup lang="ts">
import { ref } from 'wevu'

const count = ref(0)
</script>

<template>
  <view>
    <text id="plain-leaf-count">{{ count }}</text>
    <button id="plain-leaf-increment" @tap="count++">Increment leaf</button>
  </view>
</template>
