<script lang="ts">
/* eslint-disable vue/no-reserved-keys */
import { defineComponent, nextTick } from 'wevu'
import { buildResult, stringifyResult } from '../../shared/e2e'

function flattenClassValues(value: any): string[] {
  if (typeof value === 'string') {
    return [value]
  }
  if (Array.isArray(value)) {
    return value.flatMap(item => flattenClassValues(item))
  }
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(item => flattenClassValues(item))
  }
  return []
}

export default defineComponent({
  setup(_props, ctx) {
    const runE2E = async () => {
      const target = ctx.instance as any
      const state = ctx.state as any

      Object.assign(state, {
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
        markers: [
          {
            id: 1,
            latitude: 39.908823,
            longitude: 116.39747,
            width: 18,
            height: 18,
          },
          {
            id: 2,
            latitude: 39.914889,
            longitude: 116.403873,
            width: 18,
            height: 18,
          },
        ],
        events: [
          { id: 'event-0', isPublic: true },
          { id: 'event-1', isPublic: false },
        ],
        selectedEventIdx: 0,
        isExpand: { callout: true },
        root: undefined,
      })

      await nextTick()

      state.root = { a: 'root-ready' }

      await nextTick()

      const data = target.data || {}
      const classBindingEntries = Object.entries(data).filter(([key]) => /^__wv_cls_\d+$/.test(key))
      const classValues = classBindingEntries.flatMap(([, value]) => flattenClassValues(value))

      const checks = {
        enabledUpdated: data.enabled === true,
        classStateUpdated: data.toggleClass === 'state-ready',
        classArrayUpdated: Array.isArray(data.classList),
        classFlagsUpdated: Boolean(data.classFlags?.active) && !data.classFlags?.disabled,
        styleObjectUpdated: data.styleObject?.fontSize === '28rpx',
        styleArrayUpdated: Array.isArray(data.styleArray),
        mapSlotWidthClassResolved: classValues.some(value => value.includes('w-[164rpx]')),
        mapSlotSelectedClassResolved: classValues.some(value => value.includes('bg-highlight-dark')),
        mapSlotUnselectedClassResolved: classValues.some(value => value.includes('bg-white')),
        rootGuardClassResolved: classValues.some(value => value.includes('root-ready')),
      }

      const result = buildResult('class-style', checks, {
        classList: data.classList,
        classFlags: data.classFlags,
        styleObject: data.styleObject,
        styleArray: data.styleArray,
        styleText: data.styleText,
        root: data.root,
        classBindingEntries,
      })

      state.__e2e = result
      state.__e2eText = stringifyResult(result)
      await nextTick()

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
    markers: [] as any[],
    events: [] as Array<{ id: string, isPublic: boolean }>,
    selectedEventIdx: -1,
    isExpand: {
      callout: false,
    } as { callout: boolean },
    root: undefined as undefined | { a: string },
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

    <map
      id="class-style-map"
      class="map-zone"
      :markers="markers"
      latitude="39.9100"
      longitude="116.4000"
      scale="13"
    >
      <!-- eslint-disable-next-line vue/valid-v-slot -->
      <template #callout>
        <cover-view
          v-for="(event, index) in events"
          :key="event.id"
          :marker-id="index"
          class="relative h-[64rpx] flex items-center rounded-full p-[8rpx] shadow-lg" :class="[
            isExpand.callout ? 'w-[164rpx]' : 'w-[64rpx]',
            selectedEventIdx === index ? (event.isPublic ? 'bg-highlight-dark' : 'bg-theme-dark') : 'bg-white',
          ]"
        >
          callout-{{ index }}
        </cover-view>
      </template>
    </map>

    <view v-if="root" id="guard-root-class" :class="root.a">
      root-guard-class
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

.map-zone {
  width: 100%;
  height: 220rpx;
  margin-top: 14rpx;
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
