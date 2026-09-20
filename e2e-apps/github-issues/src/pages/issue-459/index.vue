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

function hasOwn(source: object, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(source, key)
}

const request = new RequestPolyfill(new URLPolyfill('/abc', 'https://issue-459.invalid'))
const response = new ResponsePolyfill('123')
const requestUrl = request.url
const requestHasOwnBody = hasOwn(request, 'body')
const responseHasOwnBody = hasOwn(response, 'body')
const responseHasOwnBodyValue = hasOwn(response as Record<string, unknown>, 'bodyValue')
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
    <text id="issue459-requestUrl" class="issue459-line">requestUrl = {{ requestUrl }}</text>
    <text id="issue459-requestOwnBody" class="issue459-line">requestOwnBody = {{ requestHasOwnBody }}</text>
    <text id="issue459-responseOwnBody" class="issue459-line">responseOwnBody = {{ responseHasOwnBody }}</text>
    <text id="issue459-responseOwnBodyValue" class="issue459-line">responseOwnBodyValue = {{ responseHasOwnBodyValue }}</text>
    <text id="issue459-responseKeys" class="issue459-line">responseKeys = {{ responseKeys.split(',').sort().join(',') }}</text>
    <text id="issue459-textCodec" class="issue459-line">textCodec = {{ textCodecRoundTrip }}</text>
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
