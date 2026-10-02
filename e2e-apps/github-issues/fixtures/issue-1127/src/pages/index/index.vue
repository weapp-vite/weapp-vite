<script setup lang="ts">
import { shallowRef } from 'wevu'
import EmitProbe from '../../components/emitProbe/index.vue'
import SignalBoundary from '../../components/signalBoundary/index.vue'

const events = shallowRef(0)
function clicked() {
  events.value++
}
const detail = shallowRef('')
const taps = shallowRef(0)
const nativeTaps = shallowRef(0)
const nativeClicks = shallowRef(0)
const inputs = shallowRef(0)
const inputValue = shallowRef('')
const nativeValue = shallowRef('')
const signals = shallowRef(0)
const signalDetail = shallowRef('')
function payload(value: { message: string, count: number }) {
  detail.value = `${value.message}:${value.count}`
}
function tapped() {
  taps.value++
}
function nativeTap() {
  nativeTaps.value++
}
function nativeClick() {
  nativeClicks.value++
}
function input(value: { value: string, source: string }) {
  inputs.value++
  inputValue.value = `${value.source}:${value.value}`
}
function nativeInput(event: { detail: { value: string } }) {
  nativeValue.value = event.detail.value
}
function signal(value: { value: number }) {
  signals.value++
  signalDetail.value = String(value.value)
}
</script>

<template>
  <EmitProbe id="emit-probe" @click="clicked" @tap="tapped" @payload="payload" @input="input" />
  <text id="custom-count">{{ events }}</text>
  <text id="custom-detail">{{ detail }}</text>
  <text id="host-tap-count">{{ taps }}</text>
  <text id="input-count">{{ inputs }}</text>
  <text id="input-value">{{ inputValue }}</text>
  <button id="native-tap" @tap="nativeTap">Native tap</button>
  <button id="native-click" @click="nativeClick">Native click</button>
  <text id="native-tap-count">{{ nativeTaps }}</text>
  <text id="native-click-count">{{ nativeClicks }}</text>
  <textarea id="native-input" @input="nativeInput" />
  <text id="native-input-value">{{ nativeValue }}</text>
  <SignalBoundary id="signal-boundary" @signal="signal" />
  <text id="page-signal-count">{{ signals }}</text>
  <text id="page-signal-detail">{{ signalDetail }}</text>
</template>
