<script setup lang="ts">
const sayHello = () => 'Hello'

function _runE2E() {
  const hello = sayHello()
  const merged = `${sayHello()}World`
  return {
    ok: hello === 'Hello' && merged === 'HelloWorld',
    hello,
    merged,
  }
}
</script>

<template>
  <view class="issue297-page">
    <text class="issue297-title">
      issue-297 interpolation call
    </text>
    <text class="issue297-line">
      {{ sayHello() }}
    </text>
    <text class="issue297-line">
      World
    </text>
    <text class="issue297-merged">
      {{ sayHello() }}World
    </text>
  </view>
</template>

<style scoped>
.issue297-page {
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.issue297-title,
.issue297-line,
.issue297-merged {
  display: block;
  margin-top: 16rpx;
  color: #334155;
  font-size: 28rpx;
}
</style>
