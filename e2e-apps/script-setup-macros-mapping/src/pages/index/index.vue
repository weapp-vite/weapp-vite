<script setup lang="ts">
import { ref } from 'wevu'
import JsRuntimeArray from '../../components/js-runtime-array/index.vue'
import JsRuntimeObject from '../../components/js-runtime-object/index.vue'
import TsRuntimeObject from '../../components/ts-runtime-object/index.vue'
import TsWithDefaultsAlias from '../../components/ts-with-defaults-alias/index.vue'
import TsWithDefaults from '../../components/ts-with-defaults/index.vue'
import NativeBadge from '../../native/native-badge/index'

definePageJson({
  navigationBarTitleText: 'script setup macros mapping',
})

const logs = ref<string[]>([])

function pushLog(value: string) {
  logs.value = [value, ...logs.value].slice(0, 10)
}

function onTsDefaultsSave(payload: { title?: string, count?: number }) {
  pushLog(`ts-defaults-save:${payload.title ?? ''}:${payload.count ?? 0}`)
}

function onTsDefaultsReset() {
  pushLog('ts-defaults-reset')
}

function onTsAliasPick(value: number) {
  pushLog(`ts-alias-pick:${value}`)
}

function onTsAliasClose() {
  pushLog('ts-alias-close')
}

function onTsRuntimeToggle(value: boolean) {
  pushLog(`ts-runtime-toggle:${value ? '1' : '0'}`)
}

function onTsRuntimeResize(value: number) {
  pushLog(`ts-runtime-resize:${value}`)
}

function onJsArraySubmit(payload: { foo?: string, bar?: string }) {
  pushLog(`js-array-submit:${payload.foo ?? ''}:${payload.bar ?? ''}`)
}

function onJsArrayCancel() {
  pushLog('js-array-cancel')
}

function onJsObjectChange(value: number) {
  pushLog(`js-object-change:${value}`)
}

function onJsObjectClose() {
  pushLog('js-object-close')
}
</script>

<template>
  <view class="page">
    <text class="title">
      script setup macros mapping
    </text>

    <NativeBadge text="native-component-ready" tone="success" />

    <TsWithDefaults @save="onTsDefaultsSave" @reset="onTsDefaultsReset" />

    <TsWithDefaultsAlias @pick="onTsAliasPick" @close="onTsAliasClose" />

    <TsRuntimeObject
      label="runtime-object"
      :active="true"
      :size="18"
      @toggle="onTsRuntimeToggle"
      @resize="onTsRuntimeResize"
    />

    <JsRuntimeArray
      foo="foo-from-page"
      bar="bar-from-page"
      @submit="onJsArraySubmit"
      @cancel="onJsArrayCancel"
    />

    <JsRuntimeObject
      message="js-message-from-page"
      :level="2"
      @change="onJsObjectChange"
      @close="onJsObjectClose"
    />

    <view v-for="(line, index) in logs" :key="index" class="log-line">
      <text>{{ line }}</text>
    </view>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  padding: 16rpx;
}

.title {
  display: block;
  margin-bottom: 16rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.log-line {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #334155;
}
</style>
