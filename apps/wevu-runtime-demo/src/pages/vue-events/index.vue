<script setup lang="ts">
import { ref } from 'wevu'

type TapEvent = WechatMiniprogram.TouchEvent

const logs = ref<string[]>([])
const count = ref(0)

function append(message: string) {
  logs.value = [message, ...logs.value].slice(0, 12)
}

function handleTap() {
  count.value += 1
  append(`@tap clicked: count=${count.value}`)
}

function handleWithArgs(name: string, event: TapEvent) {
  append(`inline args: ${name}, type=${event.type}, target=${(event.currentTarget as any)?.id ?? ''}`)
}

function handleOnce() {
  append('once handler fired')
}

function clear() {
  logs.value = []
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      事件绑定
    </view>

    <view class="section">
      <view class="section-title">
        v-on（简写 @ ）
      </view>
      <view class="demo-item">
        <text class="label">
          count: {{ count }}
        </text>
        <button class="btn btn-primary" @tap="handleTap">
          click → tap
        </button>
      </view>

      <view class="card">
        <button id="btn-args" class="btn btn-success" @tap="handleWithArgs('ok', $event)">
          内联表达式 + $event
        </button>
        <button class="btn btn-info" @tap="() => append('arrow handler')">
          箭头函数
        </button>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        修饰符（语法覆盖）
      </view>
      <view class="card">
        <text class="muted">
          修饰符在小程序侧未必等价，仅展示 Vue 写法：.stop / .prevent / .self / .once / .capture / .passive
        </text>
        <button class="btn btn-primary" @tap.stop.prevent="append('stop+prevent')">
          .stop.prevent
        </button>
        <button class="btn btn-success" @tap.once="handleOnce">
          .once
        </button>
        <view class="outer" @tap.capture="append('capture outer')">
          <view class="inner" @tap.self="append('self inner')">
            <text>capture / self</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        键盘修饰符（语法覆盖）
      </view>
      <view class="card">
        <text class="muted">
          在 Web 端常见：@keyup.enter / @keydown.esc
        </text>
        <input class="input" placeholder="仅语法覆盖" @keyup.enter="append('enter')" @keydown.esc="append('esc')">
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        日志
      </view>
      <view class="demo-item">
        <text class="label">
          最近事件（最多 12 条）
        </text>
        <button class="btn btn-warning" @tap="clear">
          清空
        </button>
      </view>
      <view class="card">
        <view v-for="(item, index) in logs" :key="index" class="log">
          <text>{{ item }}</text>
        </view>
        <text v-if="!logs.length" class="muted">
          暂无
        </text>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.container {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  box-sizing: border-box;
}

.page-title {
  font-size: 34rpx;
  font-weight: 700;
}

.section {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 18rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.06);
}

.section-title {
  font-size: 28rpx;
  font-weight: 700;
  margin-bottom: 12rpx;
}

.demo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  padding: 14rpx 0;
}

.label {
  font-size: 24rpx;
  color: #475569;
}

.btn {
  padding: 14rpx 18rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.btn-primary {
  background: #111827;
  color: #ffffff;
}

.btn-success {
  background: #2563eb;
  color: #ffffff;
}

.btn-info {
  background: #0ea5e9;
  color: #ffffff;
}

.btn-warning {
  background: #f59e0b;
  color: #111827;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.muted {
  font-size: 22rpx;
  color: #64748b;
  line-height: 1.6;
}

.outer {
  padding: 16rpx;
  border-radius: 12rpx;
  background: #eef2ff;
}

.inner {
  padding: 16rpx;
  border-radius: 12rpx;
  background: #ffffff;
  border: 1rpx dashed #c7d2fe;
}

.input {
  padding: 14rpx 16rpx;
  background: #ffffff;
  border-radius: 12rpx;
  border: 1rpx solid #e2e8f0;
  font-size: 26rpx;
}

.log {
  padding: 12rpx;
  border-radius: 12rpx;
  background: #ffffff;
  border: 1rpx solid #e2e8f0;
  font-size: 24rpx;
  color: #0f172a;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "事件绑定",
  "navigationBarBackgroundColor": "#111827",
  "navigationBarTextStyle": "white"
}
</json>
