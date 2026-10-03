<script setup>
import { ref } from 'wevu'
import { label, utility } from '../../batch'

const count = ref(0)
const input = ref('held')
function increment() {
  count.value += 1
}
</script>

<template>
  <view id="issue-1081-utility" :class="utility">batch utility</view>
  <view id="batch-label">{{ label }}</view>
  <view id="module-panel" :class="$style.panel">module panel</view>
  <button id="increment" @tap="increment">{{ count }}</button>
  <input id="held-input" v-model="input">
</template>

<style module>
.panel { color: #123; }
</style>
