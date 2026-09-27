<script setup lang="ts">
import type { RendererEvent } from '@wevu/json-render'
import { onUnload } from 'wevu'
import { readMetrics as readRuntimeMetrics, resetMetrics, trackSetData } from '../../runtime/metrics'
import { createDemoSession } from '../../runtime/session'

definePageJson({
  usingComponents: {
    'business-node': '/components/business-node/index',
  },
})
resetMetrics()
trackSetData()
function readMetrics() {
  return readRuntimeMetrics()
}
defineExpose({ readMetrics })
const session = createDemoSession()
const model = session.model
const tree = session.tree
function onNodeEvent(event: RendererEvent) {
  void session.receive(event)
}
function load() {
  session.load()
}
function reset() {
  session.reset()
}
function play() {
  session.play()
}
function injectInvalid() {
  session.push('{"op":"replace","path":"/elements/form/type","value":"Unknown"}\n')
}
onUnload(() => session.dispose())
</script>

<template>
  <view class="page">
    <text class="kicker">售后服务 · 演示订单</text>
    <text class="heading">让每一次购物都有回应。</text>
    <text class="intro">填写商品问题，我们会为你安排后续处理。</text>
    <json-renderer v-if="tree" generic:custom-node="business-node" :node="tree" @node-event="onNodeEvent" />
    <view class="demo-controls">
      <text class="demo-title">演示控制</text>
      <view class="buttons">
        <button id="load" size="mini" @tap="load">加载完整 JSON</button>
        <button id="play" size="mini" :disabled="model.playing" @tap="play">播放增量更新</button>
        <button id="reset" size="mini" @tap="reset">重置</button>
        <button id="invalid" size="mini" @tap="injectInvalid">验证异常恢复</button>
      </view>
      <text class="note">{{ model.playing ? '正在更新服务说明…' : '可播放增量更新，已填写内容会保留。' }}</text>
      <text class="note">原因包含“失败”时模拟提交失败，可修改后重试。</text>
      <text v-if="model.error" id="protocol-error" class="error">{{ model.error }}</text>
    </view>
  </view>
</template>

<style>
page {
  color: #253529;
  background: #f5f4ef;
}

.page {
  padding: 40rpx 32rpx 64rpx;
}

.kicker {
  font-size: 24rpx;
  color: #687160;
}

.heading {
  display: block;
  margin-top: 24rpx;
  font-size: 44rpx;
  font-weight: 600;
  line-height: 1.4;
}

.intro {
  display: block;
  margin: 20rpx 0 40rpx;
  font-size: 27rpx;
  color: #62675e;
}

.demo-controls {
  padding-top: 28rpx;
  margin-top: 48rpx;
  border-top: 1rpx solid #dcded5;
}

.demo-title {
  font-size: 24rpx;
  color: #62675e;
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin: 20rpx 0;
}

.buttons button {
  margin: 0;
  font-size: 23rpx;
}

.note {
  display: block;
  margin-top: 12rpx;
  font-size: 23rpx;
  color: #737a6c;
}

.error {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #a03528;
}
</style>
