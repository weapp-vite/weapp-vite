<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiVantSidebarItemPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-sidebar-item',
}))

const activeKey = ref(0)
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-sidebar-item
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-sidebar :active-key="activeKey">
          <van-sidebar-item title="侧边栏 1" />
          <van-sidebar-item title="侧边栏 2" />
        </van-sidebar>
      </view>
    </view>
  </van-config-provider>
</template>
