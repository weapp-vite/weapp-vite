<script setup lang="ts">
import { io, Manager } from 'socket.io-client'
import { computed } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-420',
})

const manager = new Manager('wss://socket.invalid', {
  autoConnect: false,
  transports: ['websocket'],
})

const socket = io('wss://socket.invalid/github-issues', {
  autoConnect: false,
  forceNew: true,
  transports: ['websocket'],
})

const transportName = computed(() => manager.engine?.transport.name ?? 'websocket')

function _runE2E() {
  return {
    hasSocket: Boolean(socket),
    transportName: transportName.value,
  }
}
</script>

<template>
  <view class="issue420-page">
    <text class="issue420-title">issue-420 socket.io-client bootstrap</text>
    <text class="issue420-line">transport = {{ transportName }}</text>
    <text class="issue420-line">namespace = {{ socket.nsp }}</text>
  </view>
</template>

<style scoped>
.issue420-page {
  padding: 32rpx;
}

.issue420-title,
.issue420-line {
  display: block;
  margin-bottom: 24rpx;
}
</style>
