<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiVantDialogPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-dialog',
}))

const show = ref(false)
function open() { show.value = true }
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-dialog
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-button size="small" @click="open">打开</van-button>
      <van-dialog :show="show" title="van-dialog" message="message" @close="show = false" />
    </view>
  </view>
</van-config-provider>
</template>

