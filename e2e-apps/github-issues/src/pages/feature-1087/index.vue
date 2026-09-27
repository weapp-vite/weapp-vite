<script setup lang="ts">
import { useFeature1087Views } from '../../shared/feature1087Views'

definePageJson({ navigationBarTitleText: '1087 WebView lists', renderer: 'webview', disableScroll: true })
const {
  contentReady,
  marker,
  primaryTop,
  primaryLeft,
  secondaryTop,
  onPrimaryScroll,
  onSecondaryScroll,
  _setPosition,
  _deferPosition,
  _loadContent,
  _restore,
  _beginDeferredRestore,
  _invalidate,
  _snapshot,
  _measure,
  _release,
  _navigate,
} = useFeature1087Views()
defineExpose({ _setPosition, _deferPosition, _loadContent, _restore, _beginDeferredRestore, _invalidate, _snapshot, _measure, _release, _navigate })
</script>

<template>
  <view id="feature1087-lists">
    <text id="feature1087-marker">{{ marker }}</text>
    <scroll-view id="feature1087-primary" class="scroll-surface" style="width: 300px; height: 180px" scroll-y scroll-x :scroll-top="primaryTop" :scroll-left="primaryLeft" :scroll-with-animation="false" @scroll="onPrimaryScroll">
      <view v-if="contentReady" id="feature1087-content" class="primary-content" style="width: 1000px; height: 1800px">
        <text>Primary list: independent horizontal and vertical scroll</text>
        <view class="distant-row">Primary distant row</view>
      </view>
    </scroll-view>
    <scroll-view id="feature1087-secondary" class="scroll-surface" style="width: 300px; height: 180px" scroll-y :scroll-top="secondaryTop" :scroll-with-animation="false" @scroll="onSecondaryScroll">
      <view v-if="contentReady" class="secondary-content" style="height: 1800px">
        <text>Secondary list: independently remembered position</text>
        <view class="distant-row">Secondary distant row</view>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped>
.scroll-surface {
  margin-bottom: 12px;
  border: 1px solid #64748b;
}

.primary-content {
  background: #eff6ff;
}

.secondary-content {
  background: #f0fdf4;
}

.distant-row {
  margin-top: 900px;
}
</style>
