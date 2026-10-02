<script setup lang="ts">
import { shallowRef } from 'wevu'
import SignalProbe from '../signalProbe/index.vue'

const trace = shallowRef('')
const detail = shallowRef(0)
function record(name: string, value: number) {
  trace.value = trace.value ? `${trace.value},${name}` : name
  detail.value = value
}
function capture(event: { detail: { value: number } }) {
  record('capture', event.detail.value)
}
function direct(value: { value: number }) {
  record('direct', value.value)
}
function bubble(event: { detail: { value: number } }) {
  record('bubble', event.detail.value)
}
function caught(value: { value: number }) {
  record('catch', value.value)
}
function captureCaught(value: { value: number }) {
  record('capture-catch', value.value)
}
function reset() {
  trace.value = ''
  detail.value = 0
}
defineComponentJson({ component: true })
</script>

<template>
  <view @signal.capture="capture">
    <view @signal="bubble">
      <SignalProbe id="open-signal" @signal="direct" />
      <SignalProbe id="caught-signal" @signal.stop="caught" />
      <SignalProbe id="capture-caught-signal" @signal.capture.stop="captureCaught" />
    </view>
  </view>
  <button id="reset-signal" @tap="reset">Reset signal trace</button>
  <text id="signal-trace">{{ trace }}</text>
  <text id="signal-detail">{{ detail }}</text>
</template>
