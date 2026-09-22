<script setup lang="ts">
import { navigate, snapshot } from '../../router'

function _runE2E(command = 'snapshot') {
  return command === 'snapshot' ? snapshot() : navigate(command)
}
defineExpose({ _runE2E })
</script>

<template>
  <view id="issue-1029-legacy">
    <view id="legacy-title">Unannotated page</view>
    <button id="go-back" @tap="navigate('back')">Back</button>
  </view>
</template>
