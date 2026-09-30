<script setup lang="ts">
import { ref } from 'wevu'
import { label } from './index.js'

definePage({ name: 'route1', meta: { title: 'page1' } })
const count = ref(0)
function increment() {
  count.value += 1
}
</script>

<template>
  <view id="source">vue-{{ label }}</view>
  <button id="increment" @tap="increment">{{ count }}</button>
</template>
