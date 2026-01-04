<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiVantDropdownMenuPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-dropdown-menu',
}))

const value1 = ref(0)
const options1 = ref([{ text: '全部', value: 0 }, { text: '好评', value: 1 }, { text: '差评', value: 2 }])
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-dropdown-menu
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-dropdown-menu>
          <van-dropdown-item :value="value1" :options="options1" />
        </van-dropdown-menu>
      </view>
    </view>
  </van-config-provider>
</template>
