<script setup lang="ts">
import FlexItem from '../../components/issue-521/FlexItem/index.vue'
import ScopedFlexHost from '../../components/issue-521/ScopedFlexHost/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-521',
})

function _runE2E() {
  return {
    ok: true,
    expected: 'scoped slot virtual host keeps flex children as siblings',
  }
}
</script>

<template>
  <view class="issue521-page">
    <view class="issue521-title">
      issue-521 scoped slot flex layout
    </view>

    <ScopedFlexHost v-slot="io">
      <FlexItem label="A" :val="io.xyz" />
      <FlexItem label="B" :val="io.xyz" />
    </ScopedFlexHost>
  </view>
</template>

<style scoped>
.issue521-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 28rpx;
  background: #f8fafc;
}

.issue521-title {
  margin-bottom: 18rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}
</style>
