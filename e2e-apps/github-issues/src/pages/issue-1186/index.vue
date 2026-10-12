<script setup lang="ts">
import { URLPolyfill, URLSearchParamsPolyfill } from '@wevu/web-apis'

definePageJson({ navigationBarTitleText: 'issue-1186' })
definePageMeta({ layout: false })

const url = new URLPolyfill('https://example.test/?word=%E4%BD%A0%%E5%A5%BD')
const decoded = url.searchParams.get('word')
const replacement = new URLSearchParamsPolyfill('q=%E2%28%A1').get('q')
const params = url.searchParams
url.search = '?q=%2B&literal=%2520%'
params.append('q', 'a b')
const live = params === url.searchParams && url.searchParams.getAll('q').join('|') === '+|a b'
const serialized = url.search

function _runE2E() {
  return { decoded, replacement, live, serialized }
}
</script>

<template>
  <view class="issue1186-page">
    <text id="issue1186-title">issue-1186 URL query decoding</text>
    <text id="issue1186-decoded">decoded = {{ decoded }}</text>
    <text id="issue1186-replacement">replacement = {{ replacement }}</text>
    <text id="issue1186-live">live = {{ live }}</text>
    <text id="issue1186-serialized">serialized = {{ serialized }}</text>
  </view>
</template>
