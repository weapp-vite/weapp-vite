<script setup lang="ts">
import { computed, ref } from 'wevu'
import MainVueCard from '../../components/main-vue-card/index.vue'

definePageJson({
  navigationBarTitleText: 'main vue',
  usingComponents: {
    'native-badge': '/native/native-badge/index',
  },
})

const count = ref(0)
const double = computed(() => count.value * 2)

function increase() {
  count.value += 1
}

function goToNormal() {
  wx.navigateTo({
    url: '/subpackages/normal-wevu/pages/entry/index?from=main-vue',
  })
}

function goToIndependent() {
  wx.navigateTo({
    url: '/subpackages/independent-wevu/pages/entry/index?from=main-vue',
  })
}

function runE2E() {
  increase()
  return {
    count: count.value,
    double: double.value,
  }
}

defineExpose({
  increase,
  goToNormal,
  goToIndependent,
  runE2E,
})
</script>

<template>
  <view class="page">
    <view id="main-marker">
      __WSP_MAIN_VUE__
    </view>
    <MainVueCard title="main package vue card" :count="count" :double="double" />
    <native-badge label="main package native component" />
    <view id="main-normal-path">
      /subpackages/normal-wevu/pages/entry/index
    </view>
    <view id="main-independent-path">
      /subpackages/independent-wevu/pages/entry/index
    </view>
    <view id="main-inc" class="action" @tap="increase">
      increase main
    </view>
    <view id="go-normal" class="action" @tap="goToNormal">
      go normal subpackage
    </view>
    <view id="go-independent" class="action" @tap="goToIndependent">
      go independent subpackage
    </view>
  </view>
</template>

<style>
.page {
  padding: 24rpx;
}

.action {
  margin-top: 16rpx;
}
</style>
