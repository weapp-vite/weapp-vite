<script lang="ts">
import { ref } from 'wevu'

export default {
  setup() {
    const count = ref(0)
    const increment = () => count.value++
    return { count, increment }
  },
}
</script>

<template>
  <view>
    <text id="plain-options-count">{{ count }}</text>
    <button id="plain-options-increment" @tap="increment">Increment options</button>
  </view>
</template>
