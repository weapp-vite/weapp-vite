<script setup lang="ts">
import { ref } from 'wevu'

const reactResult = ref('idle')
const nativeResult = ref('idle')

defineComponentJson({
  usingComponents: {
    'native-leaf': '../native-leaf/index',
    'react-leaf': '../react-leaf/index',
  },
})

function onReactChange(detail: { value: number }) {
  reactResult.value = `react:${detail.value}`
}

function onNativeChange(detail: { value: number }) {
  nativeResult.value = `native:${detail.value}`
}
</script>

<template>
  <view id="wevu-parent" class="parent">
    <text class="parent-title">Wevu parent</text>
    <native-leaf id="wevu-parent-native" label="wevu-to-native" :value="5" @change="onNativeChange">
      <text id="slot-wevu-to-native" class="interop-slot" data-e2e-slot="wevu-to-native" :style="{ display: 'block', height: '24px', width: '160px' }">slot:wevu-to-native</text>
    </native-leaf>
    <react-leaf id="wevu-parent-react" label="wevu-to-react" :value="6" @change="onReactChange">
      <text id="slot-wevu-to-react" class="interop-slot" data-e2e-slot="wevu-to-react" :style="{ display: 'block', height: '24px', width: '160px' }">slot:wevu-to-react</text>
    </react-leaf>
    <text id="wevu-native-result">{{ nativeResult }}</text>
    <text id="wevu-react-result">{{ reactResult }}</text>
  </view>
</template>

<style>
.parent {
  padding: 20rpx;
  margin-bottom: 20rpx;
  background: #fff;
  border: 1rpx solid #7b8794;
}

.parent-title,
.interop-slot {
  display: block;
}

.parent-title {
  font-weight: 600;
}
</style>
