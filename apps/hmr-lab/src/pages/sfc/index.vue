<template>
  <view class="sfc-page">
    <view class="sfc-page__title">SFC_TEMPLATE_MARKER</view>
    <view class="sfc-page__script">{{ scriptMarker }}</view>
    <view class="sfc-page__shared">{{ shared }}</view>
  </view>
</template>

<script setup lang="ts">
import { createSharedLabel } from '../../shared/tokens'

const scriptMarker = 'SFC_SCRIPT_MARKER'
const shared = createSharedLabel('sfc-page')
</script>

<style lang="scss">
/* stylelint-disable-next-line at-rule-no-unknown, scss/load-partial-extension */
@use "../../shared/styles/shared.scss";

.sfc-page {
  padding: 32rpx;
}

.sfc-style-marker {
  color: #be123c;
}
</style>
