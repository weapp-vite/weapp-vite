<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiVantCalendarPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-calendar',
}))

const show = ref(false)
function open() { show.value = true }
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-calendar
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-button size="small" @click="open">打开</van-button>
      <van-calendar :show="show" @close="show = false" />
    </view>
  </view>
</van-config-provider>
</template>

