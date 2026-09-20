<script setup>
import { ref } from 'wevu'

const count = ref(0)
function increment() {
  count.value += 1
}
</script>

<template>
  <view id="issue-998-utility" class="bg-[#fce7f3]">generated utility</view>
  <view id="issue-998-color" class="bg-[#fce7f3] local-priority">Tailwind import owner</view>
  <view id="issue-998-ordinary" class="ordinary">ordinary CSS</view>
  <button id="increment" @tap="increment">{{ count }}</button>
</template>

<style>
.local-priority { background-color: #1f2937; }
</style>
