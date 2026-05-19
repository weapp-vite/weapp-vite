<script lang="ts">
import { defineComponent, nextTick, reactive, ref } from 'wevu'
import { buildResult, stringifyResult } from '../../shared/e2e'

export default defineComponent({
  setup() {
    const data = reactive({
      userId: 'user-001',
    })
    const __e2e = ref({
      ok: false,
      checks: {},
    } as any)
    const __e2eText = ref('')

    async function runE2E() {
      await nextTick()
      const pages = getCurrentPages() as any[]
      const page = pages[pages.length - 1]
      const child = page?.selectComponent?.('#data-list')
      const propsSnapshot = child?.inspectProps?.()

      const checks = {
        childFound: Boolean(child),
        selectedReceived: propsSnapshot?.selected === data.userId,
        selectedTypeString: propsSnapshot?.selectedType === 'string',
      }

      const result = buildResult('non-function-prop-bind', checks, {
        propsSnapshot,
      })
      __e2e.value = result
      __e2eText.value = stringifyResult(result)
      return result
    }

    return {
      __e2e,
      __e2eText,
      data,
      runE2E,
      _runE2E: runE2E,
    }
  },
})
</script>

<template>
  <view class="page">
    <view class="title">
      Non Function Prop Bind
    </view>
    <data-list
      id="data-list"
      :selected="data.userId"
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
