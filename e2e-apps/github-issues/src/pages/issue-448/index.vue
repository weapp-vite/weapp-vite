<script setup lang="ts">
import { ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-448',
})

definePageMeta({
  layout: false,
})

const encoded = btoa('AB')
const decoded = atob(encoded)
const duration = Number(performance.now().toFixed(2))
const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(4))).join(',')
const eventType = new Event('tick').type
const customEventType = new CustomEvent('payload', {
  detail: {
    ok: true,
  },
}).type
const parsedUrl = URL.parse('/next?b=2&a=1', 'https://issue-448.invalid/base/')
const canParseUrl = URL.canParse('/next', 'https://issue-448.invalid')
const searchParams = new URLSearchParams('b=2&a=1&a=0')
const searchParamsSize = searchParams.size
searchParams.sort()
const sortedParams = searchParams.toString()
const headers = new Headers()
headers.append('Set-Cookie', 'session=issue-448')
headers.append('Set-Cookie', 'theme=dark')
const cookieCount = headers.getSetCookie().length
const jsonResponse = Response.json({ ok: true })
const jsonResponseContentType = jsonResponse.headers.get('content-type')
const errorResponse = Response.error()
const microtaskState = ref('pending')

queueMicrotask(() => {
  microtaskState.value = 'flushed'
})

function _runE2E() {
  return {
    encoded,
    decoded,
    duration,
    randomBytes,
    eventType,
    customEventType,
    parsedUrl: parsedUrl?.href,
    canParseUrl,
    searchParamsSize,
    sortedParams,
    cookieCount,
    jsonResponseContentType,
    errorResponseStatus: errorResponse.status,
    errorResponseType: errorResponse.type,
    microtaskState: microtaskState.value,
  }
}
</script>

<template>
  <view class="issue448-page">
    <text class="issue448-title">issue-448 next web runtime globals</text>
    <text class="issue448-line">encoded = {{ encoded }}</text>
    <text class="issue448-line">decoded = {{ decoded }}</text>
    <text class="issue448-line">duration = {{ duration }}</text>
    <text class="issue448-line">random = {{ randomBytes }}</text>
    <text class="issue448-line">event = {{ eventType }}</text>
    <text class="issue448-line">custom = {{ customEventType }}</text>
    <text class="issue448-line">url = {{ parsedUrl?.href }}</text>
    <text class="issue448-line">canParse = {{ canParseUrl }}</text>
    <text class="issue448-line">params = {{ sortedParams }}</text>
    <text class="issue448-line">cookies = {{ cookieCount }}</text>
    <text class="issue448-line">json = {{ jsonResponseContentType }}</text>
    <text class="issue448-line">error = {{ errorResponseStatus }}:{{ errorResponseType }}</text>
    <text class="issue448-line">microtask = {{ microtaskState }}</text>
  </view>
</template>

<style scoped>
.issue448-page {
  padding: 32rpx;
}

.issue448-title,
.issue448-line {
  display: block;
  margin-bottom: 24rpx;
}
</style>
