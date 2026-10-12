<script setup lang="ts">
import { ref } from 'wevu'
import { value } from './bar.ts'
import { otherValue } from './other.ts'

const count = ref(0)
function increment() {
  count.value += value
}
</script>

<template>
  <view id="bar-values">{{ value }}/{{ otherValue }}</view>
  <button id="bar-increment" @tap="increment">{{ count }}</button>
</template>
