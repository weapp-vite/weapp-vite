<script setup lang="ts">
import debounce from 'debounce'
import DebounceProbe from '../../components/issue-393/DebounceProbe/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-393',
  backgroundColor: '#ffffff',
})

const issue393Marker = typeof debounce === 'function'
  ? 'debounce-loaded'
  : 'debounce-missing'

function _runE2E() {
  return {
    marker: issue393Marker,
  }
}
</script>

<template>
  <view class="issue-393-page">
    <text>issue-393 sharedMode path devDependency import</text>
    <text>{{ issue393Marker }}</text>
    <DebounceProbe />
  </view>
</template>
