<script setup lang="ts">
import { ref } from 'wevu'
import { value } from './foo.ts'
import { otherValue } from './other.ts'

const count = ref(0)
function increment() {
  count.value += value
}
</script>

<template>
  <view id="foo-values">{{ value }}/{{ otherValue }}</view>
  <button id="foo-increment" @tap="increment">{{ count }}</button>
</template>
