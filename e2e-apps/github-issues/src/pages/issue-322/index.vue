<script setup lang="ts">
import { ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-322',
  backgroundColor: '#ffffff',
})

const errors = ref<Record<string, string> | undefined>(undefined)

function setEmailError() {
  errors.value = {
    ...(errors.value ?? {}),
    email: 'invalid email',
  }
}

function clearEmailError() {
  if (!errors.value?.email) {
    errors.value = undefined
    return
  }
  const next = {
    ...errors.value,
  }
  delete next.email
  errors.value = Object.keys(next).length ? next : undefined
}

function _resetE2E() {
  errors.value = undefined
  return _runE2E()
}

function _runE2E() {
  return {
    ok: true,
    hasEmailError: Boolean(errors.value?.email),
    emailError: errors.value?.email ?? '',
  }
}
</script>

<template>
  <view class="issue322-page">
    <text class="issue322-title">
      issue-322 class/v-show first paint flicker
    </text>
    <text class="issue322-subtitle">
      当 errors 初始为空时，:class 与 v-show 不应丢失静态样式或先显示后隐藏
    </text>

    <input
      class="issue322-input issue322-input-base"
      placeholder="issue-322 input"
      :class="{ 'issue322-input-error': errors.email }"
    >

    <view
      v-show="errors.email"
      class="issue322-error-tip"
    >
      email error visible
    </view>

    <view
      class="issue322-probe"
      :data-error="errors?.email || ''"
      :data-state-ready="errors ? 'yes' : 'no'"
    >
      state: {{ errors?.email || 'none' }}
    </view>

    <view class="issue322-actions">
      <view
        class="issue322-btn issue322-btn-set"
        @tap="setEmailError"
      >
        set email error
      </view>
      <view
        class="issue322-btn issue322-btn-clear"
        @tap="clearEmailError"
      >
        clear email error
      </view>
    </view>
  </view>
</template>

<style scoped>
.issue322-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.issue322-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue322-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #475569;
}

.issue322-input {
  box-sizing: border-box;
  width: 100%;
  padding: 16rpx 18rpx;
  margin-top: 18rpx;
  font-size: 24rpx;
  border-radius: 12rpx;
}

.issue322-input-base {
  color: #0f172a;
  background: #fff;
  border: 2rpx solid #94a3b8;
}

.issue322-input-error {
  border-color: #ef4444;
}

.issue322-error-tip {
  margin-top: 14rpx;
  font-size: 24rpx;
  color: #ef4444;
}

.issue322-probe {
  margin-top: 14rpx;
  font-size: 24rpx;
  color: #334155;
}

.issue322-actions {
  display: flex;
  gap: 12rpx;
  margin-top: 18rpx;
}

.issue322-btn {
  padding: 12rpx 16rpx;
  font-size: 22rpx;
  color: #fff;
  border-radius: 12rpx;
}

.issue322-btn-set {
  background: #dc2626;
}

.issue322-btn-clear {
  background: #0f766e;
}
</style>
