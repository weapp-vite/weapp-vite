<script setup lang="ts">
import { reactive, toRef, toValue } from 'wevu'

const state = reactive({ count: 0 })
const count = toRef(state, 'count')
const initial = toValue(count)
</script>

<template>
  <view>
    <text id="plain-reactive-count">{{ count }}</text>
    <text id="plain-reactive-initial">{{ initial }}</text>
    <button id="plain-reactive-increment" @tap="count++">Increment reactive</button>
  </view>
</template>
