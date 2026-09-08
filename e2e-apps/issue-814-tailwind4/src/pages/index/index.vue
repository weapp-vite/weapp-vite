<script setup lang="ts">
import { ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'Issue 814 Tailwind4',
})

const bbb = ref('-row')
const aaa = ref('items-center')
</script>

<template>
  <view class="flex gap-6">
    <view class="gap-[24px]">1</view>
    <view>2</view>
    <view>3</view>
  </view>
  <!-- eslint-disable-next-line vue/prefer-separate-static-class -- 回归必须覆盖任意值类名随动态表达式进入 JavaScript 的路径。 -->
  <view id="issue-814-dynamic" :class="[`flex${bbb} gap-[17px]`, aaa]">
    <view>1</view>
    <view>2</view>
    <view>3</view>
  </view>
</template>
