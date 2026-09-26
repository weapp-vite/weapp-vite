<script setup lang="ts">
import { shallowRef } from 'wevu'
import Issue1013Child from '../../components/issue-1013-child/index.vue'

const attr = 'title'
const value = 'dynamic-title'
const event = 'tap'
const staticTitle = 'static-title'
const dynamicTapCount = shallowRef(0)
const staticProbeTapCount = shallowRef(0)
const nativeTapCount = shallowRef(0)
const componentStatus = shallowRef('pending')

function handle() {
  dynamicTapCount.value += 1
}

function handleNativeTap() {
  nativeTapCount.value += 1
}

function handleComponentReady(status: string) {
  componentStatus.value = status
}
</script>

<template>
  <view id="issue-1013-page">
    <view
      id="issue-1013-dynamic"
      :[attr]="value"
      @[event]="handle"
      @tap="staticProbeTapCount++"
    >
      dynamic probe
    </view>
    <text id="issue-1013-dynamic-count">dynamic taps: {{ dynamicTapCount }}</text>
    <text id="issue-1013-static-probe-count">static probe taps: {{ staticProbeTapCount }}</text>
    <button
      id="issue-1013-native"
      :data-title="staticTitle"
      @click="handleNativeTap"
    >
      native taps: {{ nativeTapCount }}
    </button>
    <Issue1013Child :trigger="nativeTapCount" @ready="handleComponentReady" />
    <text id="issue-1013-component-status">component: {{ componentStatus }}</text>
  </view>
</template>
