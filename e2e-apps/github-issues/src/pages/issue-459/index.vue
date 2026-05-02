<script setup lang="ts">
import {
  RequestPolyfill,
  ResponsePolyfill,
  TextDecoderPolyfill,
  TextEncoderPolyfill,
  URLPolyfill,
} from '@wevu/web-apis'

definePageJson({
  navigationBarTitleText: 'issue-459',
})

definePageMeta({
  layout: false,
})

const request = new RequestPolyfill(new URLPolyfill('/abc', 'https://issue-459.invalid'))
const response = new ResponsePolyfill('123')
const requestUrl = request.url
const requestHasOwnBody = Object.hasOwn(request, 'body')
const responseHasOwnBody = Object.hasOwn(response, 'body')
const responseHasOwnBodyValue = Object.hasOwn(response as Record<string, unknown>, 'bodyValue')
const responseKeys = Object.keys(response).join(',')
const textCodecRoundTrip = new TextDecoderPolyfill().decode(
  new TextEncoderPolyfill().encode('issue-459'),
)

function _runE2E() {
  return {
    requestUrl,
    requestHasOwnBody,
    responseHasOwnBody,
    responseHasOwnBodyValue,
    responseKeys,
    textCodecRoundTrip,
  }
}
</script>

<template>
  <view class="issue459-page">
    <text class="issue459-title">issue-459 web-apis polyfill compatibility</text>
    <text class="issue459-line">requestUrl = {{ requestUrl }}</text>
    <text class="issue459-line">requestOwnBody = {{ requestHasOwnBody }}</text>
    <text class="issue459-line">responseOwnBody = {{ responseHasOwnBody }}</text>
    <text class="issue459-line">responseOwnBodyValue = {{ responseHasOwnBodyValue }}</text>
    <text class="issue459-line">responseKeys = {{ responseKeys }}</text>
    <text class="issue459-line">textCodec = {{ textCodecRoundTrip }}</text>
  </view>
</template>

<style scoped>
.issue459-page {
  padding: 32rpx;
}

.issue459-title,
.issue459-line {
  display: block;
  margin-bottom: 24rpx;
}
</style>
