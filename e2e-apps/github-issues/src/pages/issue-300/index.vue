<script setup lang="ts">
import { computed, ref } from 'wevu'
import PropsDestructureProbe from '../../components/issue-300/PropsDestructureProbe/index.vue'
import StrictNoPropsVarProbe from '../../components/issue-300/StrictNoPropsVarProbe/index.vue'

const strValue = ref('Hello')
const boolValue = ref(true)

const boolLabel = computed(() => String(boolValue.value))
const strLabel = computed(() => strValue.value)

function toggleBool() {
  boolValue.value = !boolValue.value
}

function toggleStr() {
  strValue.value = strValue.value === 'Hello' ? 'World' : 'Hello'
}

function syncTogglePropsInPlace() {
  boolValue.value = !boolValue.value
  strValue.value = strValue.value === 'Hello' ? 'World' : 'Hello'
}

function _runE2E() {
  return {
    str: strValue.value,
    bool: boolValue.value,
    boolText: String(boolValue.value),
    ok: ['Hello', 'World'].includes(strValue.value) && typeof boolValue.value === 'boolean',
  }
}
</script>

<template>
  <view class="issue300-page">
    <text class="issue300-title">
      issue-300 props destructure boolean binding
    </text>
    <text class="issue300-desc">
      验证 String(bool) 在 defineProps 解构场景下不再渲染为 undefined
    </text>

    <view class="issue300-toolbar">
      <view class="issue300-toggle issue300-toggle-bool" @tap="toggleBool">
        toggle bool: {{ boolLabel }}
      </view>
      <view class="issue300-toggle issue300-toggle-str" @tap="toggleStr">
        toggle str: {{ strLabel }}
      </view>
      <view class="issue300-toggle issue300-toggle-sync" @tap="syncTogglePropsInPlace">
        sync toggle props in place
      </view>
    </view>

    <PropsDestructureProbe
      :str="strValue"
      :bool="boolValue"
    />

    <view class="issue300-strict-case">
      <text class="issue300-strict-title">
        strict-no-props-var
      </text>
      <StrictNoPropsVarProbe
        :str="strValue"
        :bool="boolValue"
      />
    </view>
  </view>
</template>

<style scoped>
.issue300-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.issue300-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue300-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #475569;
}

.issue300-toolbar {
  margin-top: 14rpx;
}

.issue300-toggle {
  display: inline-flex;
  align-items: center;
  min-height: 56rpx;
  padding: 0 16rpx;
  font-size: 24rpx;
  color: #1d4ed8;
  background: #dbeafe;
  border-radius: 10rpx;
}

.issue300-strict-case {
  padding: 14rpx 18rpx;
  margin-top: 14rpx;
  background: #eff6ff;
  border: 2rpx solid #bfdbfe;
  border-radius: 12rpx;
}

.issue300-strict-title {
  display: block;
  margin-bottom: 8rpx;
  font-size: 22rpx;
  color: #1e3a8a;
}
</style>
