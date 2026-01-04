<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiVantPickerPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-picker',
}))

const show = ref(true)
const columns = ref([{ values: ['A', 'B', 'C'], defaultIndex: 0 }, { values: ['1', '2', '3'], defaultIndex: 0 }])
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-picker
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-picker :show="show" :columns="columns" />
      <van-picker-column />
    </view>
  </view>
</van-config-provider>
</template>

