<script lang="ts">
/* eslint-disable vue/no-reserved-keys */
import { defineComponent, nextTick } from 'wevu'
import { buildResult, stringifyResult } from '../../shared/e2e'

export default defineComponent({
  setup(_props, ctx) {
    const runE2E = async () => {
      const target = ctx.instance as any

      target.setData({
        enabled: true,
        toggleClass: 'state-ready',
        classList: ['root-a', '', ['nested-a', { 'nested-b': true }]],
        classFlags: {
          active: true,
          disabled: false,
        },
        styleObject: {
          'color': '#0052d9',
          'fontSize': '28rpx',
          'lineHeight': 1.6,
          '--tokenColor': '#0f62fe',
        },
        styleArray: [
          'padding:8rpx',
          { marginTop: '10rpx', borderRadius: '12rpx' },
          [{ opacity: 0.9 }],
        ],
        styleText: 'background-color:#f0f9ff',
      })

      await nextTick()

      const data = target.data || {}
      const checks = {
        enabledUpdated: data.enabled === true,
        classStateUpdated: data.toggleClass === 'state-ready',
        classArrayUpdated: Array.isArray(data.classList),
        classFlagsUpdated: Boolean(data.classFlags?.active) && !data.classFlags?.disabled,
        styleObjectUpdated: data.styleObject?.fontSize === '28rpx',
        styleArrayUpdated: Array.isArray(data.styleArray),
      }

      const result = buildResult('class-style', checks, {
        classList: data.classList,
        classFlags: data.classFlags,
        styleObject: data.styleObject,
        styleArray: data.styleArray,
        styleText: data.styleText,
      })

      target.setData({
        __e2e: result,
        __e2eText: stringifyResult(result),
      })

      return result
    }

    return {
      runE2E,
    }
  },
  data: () => ({
    enabled: false,
    toggleClass: 'state-idle',
    classList: ['root-a', 'root-b'],
    classFlags: {
      active: false,
      disabled: true,
    } as Record<string, boolean>,
    styleObject: {
      'color': '#111111',
      'fontSize': '24rpx',
      'lineHeight': 1.4,
      '--tokenColor': '#ff4d4f',
    } as Record<string, any>,
    styleArray: ['padding:4rpx', { marginTop: '6rpx' }] as any[],
    styleText: 'background-color:#ffffff',
    __e2e: {
      ok: false,
      checks: {},
    } as any,
    __e2eText: '',
  }),
})
</script>

<template>
  <view class="page">
    <view class="title">
      Class Style
    </view>
    <view class="summary">
      ok: {{ __e2e.ok }}
    </view>
    <view
      id="class-style-target"
      class="base"
      :class="[toggleClass, classList, classFlags, { ready: enabled }]"
      :style="[styleText, styleArray, styleObject]"
    >
      class-style-target
    </view>
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

.base {
  margin-top: 12rpx;
  border: 1rpx solid #d9d9d9;
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
