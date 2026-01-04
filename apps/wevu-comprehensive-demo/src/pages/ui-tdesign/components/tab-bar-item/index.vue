<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignTabBarItemPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-tab-bar-item',
}))

const value = ref('home')
function onChange(event) { value.value = event.detail?.value ?? event.detail }
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-tab-bar-item
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-tab-bar :value="value" @change="onChange">
        <t-tab-bar-item value="home" label="首页" icon="home" />
        <t-tab-bar-item value="search" label="搜索" icon="search" />
        <t-tab-bar-item value="me" label="我的" icon="user" />
      </t-tab-bar>
    </view>
  </view>
</template>
