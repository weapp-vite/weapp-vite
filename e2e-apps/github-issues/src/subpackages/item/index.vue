<script setup lang="ts">
import lodash from 'lodash'
import { ref } from 'wevu'
import { useIssue317Toast } from '../../hooks/issue-317/useToast'

definePageJson({
  navigationBarTitleText: 'issue-317-item',
})

const { showToast } = useIssue317Toast('item')
const message = ref(showToast('ready'))
const npmMarker = lodash.camelCase('issue 317 item npm ready')

function _runE2E() {
  return {
    ok: message.value.includes('ITEM:ready') && npmMarker === 'issue317ItemNpmReady',
    message: message.value,
    npmMarker,
  }
}
</script>

<template>
  <view class="issue317-page">
    <text class="issue317-title">
      issue-317 subpackage item
    </text>
    <text class="issue317-message">
      {{ message }}
    </text>
    <text class="issue317-npm-marker">
      {{ npmMarker }}
    </text>
  </view>
</template>

<style scoped>
.issue317-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #fff;
}

.issue317-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue317-message {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #334155;
}

.issue317-npm-marker {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #64748b;
}
</style>
