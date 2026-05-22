<script setup lang="ts">
import { ref } from 'wevu'
import DataPropProbe from '../../components/issue-599/DataPropProbe/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-599',
})

const probeData = ref({
  color: '#1677ff',
  size: 32,
  label: 'issue-599 data prop computed',
})

function _runE2E() {
  return {
    ok: probeData.value.label === 'issue-599 data prop computed',
    data: probeData.value,
  }
}
</script>

<template>
  <view class="issue599-page">
    <text class="issue599-title">
      issue-599 data prop computed
    </text>
    <DataPropProbe :data="probeData" />
  </view>
</template>

<style scoped>
.issue599-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.issue599-title {
  display: block;
  margin-bottom: 16rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}
</style>
