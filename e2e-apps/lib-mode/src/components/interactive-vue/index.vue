<script setup lang="ts">
import { ref } from 'wevu'

const count = ref(0)
</script>

<template>
  <view class="vue-label">Vue library</view>
  <button id="vue-increment" @tap="count++">increment</button>
  <view class="vue-count">{{ count }}</view>
</template>
