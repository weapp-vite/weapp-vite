<script setup lang="ts">
import { ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'Issue 814 Tailwind4 Broken',
})

const bbb = ref('-row')
const aaa = ref('items-center')
</script>

<template>
  <view class="flex gap-[24px]">
    <view>1</view>
    <view>2</view>
    <view>3</view>
  </view>
  <view :class="[`flex${bbb} gap-[17px]`, aaa]">
    <view>1</view>
    <view>2</view>
    <view>3</view>
  </view>
</template>
