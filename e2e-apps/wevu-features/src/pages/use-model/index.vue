<script setup lang="ts">
import { nextTick, ref } from 'wevu'
import UseModelFeature from '../../components/use-model-feature/index.vue'

const modelValue = ref('seed-model')
const emitLogs = ref<string[]>([])

function onModelUpdate(event: any) {
  const next = event?.detail ?? ''
  modelValue.value = String(next)
  emitLogs.value.push(`update:modelValue:${modelValue.value}`)
}

function setByParent(value: string) {
  modelValue.value = value
  emitLogs.value.push(`parent-set:${value}`)
}

function setParentAlpha() {
  setByParent('alpha-from-parent')
}

function setParentBeta() {
  setByParent('beta-from-parent')
}

async function runE2E() {
  const before = {
    value: modelValue.value,
    logs: emitLogs.value.length,
  }

  setParentAlpha()
  await nextTick()

  const checks = {
    valueChanged: modelValue.value !== before.value,
    logsChanged: emitLogs.value.length > before.logs,
  }

  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    state: {
      value: modelValue.value,
      logs: emitLogs.value.slice(),
    },
  }
}

const _runE2E = runE2E
</script>

<template>
  <view class="use-model-page">
    <view class="use-model-page__title">
      wevu useModel 特性展示
    </view>
    <view class="use-model-page__subtitle">
      父组件与子组件双向更新 modelValue，并记录 update:modelValue
    </view>

    <view class="use-model-page__toolbar">
      <view id="model-parent-alpha" class="use-model-page__btn" @tap="setParentAlpha">
        parent -> alpha
      </view>
      <view id="model-parent-beta" class="use-model-page__btn" @tap="setParentBeta">
        parent -> beta
      </view>
    </view>

    <view id="model-parent-value" class="use-model-page__value">
      parent modelValue = {{ modelValue }}
    </view>
    <view id="model-log-size" class="use-model-page__value">
      emit logs = {{ emitLogs.length }}
    </view>

    <UseModelFeature
      title="组件内 useModel()"
      :model-value="modelValue"
      @update:modelValue="onModelUpdate($event)"
    />
  </view>
</template>

<style scoped>
.use-model-page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24rpx;
  background: #f8fafc;
}

.use-model-page__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.use-model-page__subtitle {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #475569;
}

.use-model-page__toolbar {
  margin-top: 16rpx;
  display: flex;
  flex-wrap: wrap;
}

.use-model-page__btn {
  margin: 6rpx;
  min-height: 58rpx;
  line-height: 58rpx;
  padding: 0 16rpx;
  border-radius: 9999rpx;
  background: #e2e8f0;
  color: #1f2937;
  font-size: 22rpx;
}

.use-model-page__value {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #334155;
}
</style>
