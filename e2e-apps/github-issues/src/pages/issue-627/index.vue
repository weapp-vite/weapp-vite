<script setup lang="ts">
import ReservedPropsProbe from '../../components/issue-627/ReservedPropsProbe/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-627',
})

const reservedProps = {
  class: 'issue-627-class-prop',
  style: 'color: rgb(22, 119, 255);',
  customClass: 'issue-627-custom-class',
  customStyle: 'font-size: 32rpx;',
}
</script>

<template>
  <view class="issue627-page">
    <view class="issue627-title">
      issue-627 reserved props
    </view>
    <ReservedPropsProbe
      class="issue-627-class-prop"
      style="color: rgb(22 119 255);"
      custom-class="issue-627-custom-class"
      custom-style="font-size: 32rpx;"
    />
    <ReservedPropsProbe
      class="issue627-dynamic-probe"
      v-bind="reservedProps"
    />
  </view>
</template>

<style scoped>
.issue627-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.issue627-title {
  margin-bottom: 16rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}
</style>
