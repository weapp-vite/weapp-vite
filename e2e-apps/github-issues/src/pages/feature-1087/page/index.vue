<script setup lang="ts">
import { onReady, onUnload } from 'wevu'
import { useRoute, useScrollRestoration } from 'wevu/router'
import { allocateFeature1087Instance, feature1087Records, getFeature1087Controller, readFeature1087Probe } from '../../../shared/feature1087'
import { useFeature1087PageScroll } from '../../../shared/feature1087Page'

definePageJson({ navigationBarTitleText: '1087 WebView page scroll', renderer: 'webview' })
const path = useRoute().fullPath
const instance = allocateFeature1087Instance()
const pageScroll = useFeature1087PageScroll()
let ready = false
onReady(() => {
  ready = true
  feature1087Records.push({ phase: 'ready', instance, path })
})
onUnload(() => feature1087Records.push({ phase: 'unload', instance, path }))
useScrollRestoration({
  controller: getFeature1087Controller(),
  id: 'page-observer',
  capture() {
    feature1087Records.push({ phase: 'capture', instance, path })
    return { path }
  },
  restore(_saved, context) {
    feature1087Records.push({ phase: 'restore:applied', instance, path, ready, routeEventId: context.routeEventId })
  },
})
function _setPosition(top: number) {
  return new Promise<void>((resolve, reject) => {
    wx.pageScrollTo({ scrollTop: top, duration: 0, success: () => resolve(), fail: reject })
  })
}
function _measure() {
  return new Promise<unknown[]>((resolve) => {
    wx.createSelectorQuery().selectViewport().scrollOffset().exec(resolve)
  })
}
function _snapshot() {
  return { ...readFeature1087Probe(), instance, path, ready }
}
function _restore() {
  return pageScroll.scroll()
}
defineExpose({ _setPosition, _measure, _snapshot, _restore })
</script>

<template>
  <view id="feature1087-page" class="page-content">
    <text>WebView document scrolling</text>
    <view class="distant-row">Saved page position is below the first viewport</view>
  </view>
</template>

<style scoped>
.page-content {
  height: 3600px;
  background: #eff6ff;
}

.distant-row {
  padding-top: 1200px;
}
</style>
