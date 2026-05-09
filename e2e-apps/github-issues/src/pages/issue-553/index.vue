<script setup lang="ts">
import { ref } from 'wevu'
import ModelTitleCell from '../../components/issue-553/ModelTitleCell/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-553',
})

const title = ref('issue-553 initial title')

function _runE2E() {
  return {
    title: title.value,
  }
}
</script>

<template>
  <view class="issue553-page">
    <view class="issue553-title">
      issue-553 component v-model argument
    </view>

    <ModelTitleCell v-model:title="title" />

    <text
      class="issue553-parent-title"
      :data-issue553-parent-title="title"
    >
      {{ title }}
    </text>
  </view>
</template>

<style scoped>
.issue553-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 28rpx;
  background: #f8fafc;
}

.issue553-title {
  margin-bottom: 18rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.issue553-parent-title {
  display: block;
  margin-top: 20rpx;
  color: #0369a1;
}
</style>
