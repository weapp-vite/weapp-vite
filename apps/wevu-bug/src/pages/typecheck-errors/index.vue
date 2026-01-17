<script setup lang="ts">
import { computed, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'typecheck-errors',
})

const props = defineProps<{
  title: string
  retries: number
}>()

const badRef = ref<number>('oops')
const badComputed = computed<number>(() => props.title)

function takesNumber(value: number) {
  return value
}

const fromString = takesNumber(props.title)
const badUnion: 'a' | 'b' = 'c'
</script>

<template>
  <view class="page">
    <text class="title">Typecheck Errors Demo</text>
    <text class="line">badRef: {{ badRef }}</text>
    <text class="line">badComputed: {{ badComputed }}</text>
    <text class="line">fromString: {{ fromString }}</text>
    <text class="line">badUnion: {{ badUnion }}</text>
  </view>
</template>

<style>
.page {
  padding: 48rpx 32rpx;
  color: #1c1c3c;
}

.title {
  display: block;
  margin-bottom: 24rpx;
  font-size: 32rpx;
  font-weight: 600;
}

.line {
  display: block;
  margin-bottom: 16rpx;
  font-size: 26rpx;
}
</style>
