<script setup lang="ts">
import { shallowRef } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-1014',
})

const explicitTapCount = shallowRef(0)
const attrs = {
  'data-object': 'unsupported-object-attr',
  'title': 'unsupported-object-title',
}

function handleObjectTap() {
  explicitTapCount.value += 100
}

function handleExplicitTap() {
  explicitTapCount.value += 1
}

const handlers = {
  tap: handleObjectTap,
}
</script>

<template>
  <view id="issue1014-page" class="issue1014-page">
    <text id="issue1014-title">
      issue 1014 object directives
    </text>
    <view
      id="issue1014-object-directives"
      v-bind="attrs"
      v-on="handlers"
    >
      unsupported object forms are diagnostic-only
    </view>
    <button
      id="issue1014-explicit-control"
      :data-title="attrs.title"
      @tap="handleExplicitTap"
    >
      explicit control
    </button>
    <text id="issue1014-explicit-count">
      {{ explicitTapCount }}
    </text>
  </view>
</template>

<style scoped>
.issue1014-page {
  padding: 24rpx;
}
</style>
