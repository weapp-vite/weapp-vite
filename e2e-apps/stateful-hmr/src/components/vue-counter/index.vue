<script setup lang="ts">
import { ref } from 'wevu'

const count = ref(0)
const result = ref('ready')

function increment() {
  count.value += 1
  result.value = 'step:1'
}
</script>

<template>
  <view>
    <view class="child-count">{{ count }}</view>
    <view class="child-result">{{ result }}</view>
    <button class="child-increment" @tap="increment">increment Vue child</button>
  </view>
</template>
