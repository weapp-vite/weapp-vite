<script lang="ts">
import { defineComponent, nextTick, ref } from 'wevu'
import { buildResult, stringifyResult } from '../../shared/e2e'

export default defineComponent({
  setup() {
    const calls = ref<string[]>([])
    const currentKey = ref<'active'>('active')
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

    const handlers = {
      save(payload: string) {
        const value = `handler:${payload}`
        calls.value.push(value)
        return value
      },
    }
    const meta = {
      title: 'static-member-title',
    }
    const labels = {
      active: 'computed-member-label',
    }

    async function runE2E() {
      await nextTick()
      const pages = getCurrentPages() as any[]
      const page = pages[pages.length - 1]
      const child = page?.selectComponent?.('#function-prop-child')
      const callbackResult = child?.invokeCallback?.('auto')
      const handlerResult = child?.invokeHandler?.('member')
      const propsSnapshot = child?.inspectProps?.()

      const checks = {
        childFound: Boolean(child),
        callbackReceived: callbackResult?.type === 'function' && callbackResult?.value === 'callback:auto',
        handlerReceived: handlerResult?.type === 'function' && handlerResult?.value === 'handler:member',
        staticMemberValueReceived: propsSnapshot?.metaTitle === 'static-member-title',
        computedMemberValueReceived: propsSnapshot?.dynamicLabel === 'computed-member-label',
        staticMemberHandlerIsFunction: propsSnapshot?.handlerType === 'function',
        parentCallbackCalled: calls.value.includes('callback:auto'),
        parentHandlerCalled: calls.value.includes('handler:member'),
      }

      const result = buildResult('function-props-auto', checks, {
        calls: calls.value,
        callbackResult,
        handlerResult,
        propsSnapshot,
      })
      __e2e.value = result
      __e2eText.value = stringifyResult(result)
      return result
    }

    return {
      __e2e,
      __e2eText,
      callback,
      currentKey,
      handlers,
      labels,
      meta,
      runE2E,
      _runE2E: runE2E,
    }
  },
})
</script>

<template>
  <view class="page">
    <view class="title">
      Function Props Auto
    </view>
    <view class="summary">
      ok: {{ __e2e.ok }}
    </view>
    <x-function-prop-child
      id="function-prop-child"
      :callback="callback"
      :handler="handlers.save"
      :meta-title="meta.title"
      :dynamic-label="labels[currentKey]"
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
