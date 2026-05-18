<script lang="ts">
import { defineComponent, nextTick, ref } from 'wevu'
import { buildResult, stringifyResult } from '../../shared/e2e'

export default defineComponent({
  allowFunctionProps: false,
  setup() {
    const calls = ref<string[]>([])
    const __e2e = ref({
      ok: false,
      checks: {},
    } as any)
    const __e2eText = ref('')

    function callback(payload: string) {
      const value = `callback:${payload}`
      calls.value.push(value)
      return value
    }

    async function runE2E() {
      await nextTick()
      const pages = getCurrentPages() as any[]
      const page = pages[pages.length - 1]
      const child = page?.selectComponent?.('#function-prop-child')
      const callbackResult = child?.invokeCallback?.('disabled')

      const checks = {
        childFound: Boolean(child),
        callbackFiltered: callbackResult?.type !== 'function',
        parentCallbackNotCalled: calls.value.length === 0,
      }

      const result = buildResult('function-props-disabled', checks, {
        calls: calls.value,
        callbackResult,
      })
      __e2e.value = result
      __e2eText.value = stringifyResult(result)
      return result
    }

    return {
      __e2e,
      __e2eText,
      callback,
      runE2E,
      _runE2E: runE2E,
    }
  },
})
</script>

<template>
  <view class="page">
    <view class="title">
      Function Props Disabled
    </view>
    <view class="summary">
      ok: {{ __e2e.ok }}
    </view>
    <x-function-prop-child
      id="function-prop-child"
      :callback="callback"
    />
    <text selectable class="details">
      {{ __e2eText }}
    </text>
  </view>
</template>

<style>
.page {
  padding: 20rpx;
}

.title {
  font-size: 32rpx;
  font-weight: 600;
}

.summary {
  margin-top: 8rpx;
  color: #666;
}

.details {
  display: block;
  margin-top: 16rpx;
}
</style>

<json>
{
  "component": false
}
</json>
