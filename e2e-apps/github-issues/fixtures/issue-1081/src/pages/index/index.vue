<script setup>
import { ref } from 'wevu'

const count = ref(0)
const input = ref('held')
const utility = 'py-5.5 bg-[#fce7f3] text-brand'
function increment() {
  count.value += 1
}
</script>

<template>
  <view id="issue-1081-utility" :class="utility">batch utility</view>
  <button id="increment" @tap="increment">{{ count }}</button>
  <input id="held-input" v-model="input" />
</template>
