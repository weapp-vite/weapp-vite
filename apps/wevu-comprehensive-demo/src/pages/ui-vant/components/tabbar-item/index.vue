<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiVantTabbarItemPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-tabbar-item',
}))

const active = ref(0)
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-tabbar-item
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-tabbar :active="active">
        <van-tabbar-item icon="home-o">首页</van-tabbar-item>
        <van-tabbar-item icon="search">搜索</van-tabbar-item>
        <van-tabbar-item icon="friends-o">我的</van-tabbar-item>
      </van-tabbar>
    </view>
  </view>
</van-config-provider>
</template>

