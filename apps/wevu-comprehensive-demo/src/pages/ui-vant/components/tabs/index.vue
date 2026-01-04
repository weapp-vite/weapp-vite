<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiVantTabsPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-tabs',
}))

const active = ref(0)
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-tabs
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-tabs :active="active">
          <van-tab title="Tab 1">
            Tab 1 content
          </van-tab>
          <van-tab title="Tab 2">
            Tab 2 content
          </van-tab>
        </van-tabs>
      </view>
    </view>
  </van-config-provider>
</template>
