<script lang="ts">
import { defineComponent, nextTick } from 'wevu'
import { buildResult, stringifyResult } from '../../shared/e2e'

function readRuntimeStyles() {
  const currentPages = getCurrentPages() as any[]
  const currentPage = currentPages[currentPages.length - 1] as any
  const styleBindingEntries = Object.entries(currentPage?.data || {})
    .filter(([key]) => /^__wv_style_\d+$/.test(key))
  const styleValues = styleBindingEntries
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string')
  return {
    styleBindingEntries,
    styleValues,
  }
}

async function waitForRuntimeStyles(timeoutMs = 3_000) {
  const expectedTexts = [
    '#0f766e',
    'font-size:28rpx',
    'webkit-line-clamp:3',
    'padding:8rpx',
    'translate3d(1px, 0, 0)',
    '#111827',
    '#345678',
    '#ff4d4f !important',
    '--chip-bg:#e6f4ff',
    'border-width:2rpx',
  ]
  const start = Date.now()
  let latest = readRuntimeStyles()
  while (Date.now() - start <= timeoutMs) {
    if (expectedTexts.every(text => latest.styleValues.some(value => value.includes(text)))) {
      return latest
    }
    await new Promise(resolve => setTimeout(resolve, 50))
    latest = readRuntimeStyles()
  }
  return latest
}

export default defineComponent({
  setup(_props, ctx) {
    const runE2E = async () => {
      const state = ctx.state as any
      Object.assign(state, {
        isReady: true,
        styleString: 'color:#0f766e;background-color:#ecfeff',
        styleObject: {
          fontSize: '28rpx',
          lineHeight: 1.6,
          borderRadius: '12rpx',
        },
        styleCamelObject: {
          backgroundColor: '#eff6ff',
          marginTop: '10rpx',
          WebkitLineClamp: 3,
        },
        styleArray: [
          'padding:8rpx',
          { marginTop: '10rpx', borderColor: '#91caff' },
        ],
        styleNestedArray: [
          'display:block',
          [{ opacity: 1 }, [{ transform: 'translate3d(1px, 0, 0)' }]],
        ],
        styleNullable: [
          null,
          undefined,
          false,
          '',
          { color: '#111827', marginBottom: null, padding: '4rpx' },
        ],
        styleOverride: [
          { color: '#123456' },
          'color:#234567',
          { color: '#345678' },
        ],
        styleImportant: [
          { color: '#ff4d4f !important' },
          'background-color:#fff1f0',
        ],
        styleCssVar: [
          {
            '--chip-bg': '#e6f4ff',
            '--chip-color': '#0958d9',
          },
          'color:var(--chip-color)',
          { backgroundColor: 'var(--chip-bg)' },
        ],
      })

      await nextTick()

      const { styleBindingEntries, styleValues } = await waitForRuntimeStyles()
      const hasStyleText = (text: string) => styleValues.some(value => value.includes(text))
      const checks = {
        stringUpdated: state.styleString.includes('#0f766e') && hasStyleText('#0f766e'),
        objectUpdated: state.styleObject?.fontSize === '28rpx' && hasStyleText('font-size:28rpx'),
        camelCaseUpdated: state.styleCamelObject?.WebkitLineClamp === 3 && hasStyleText('webkit-line-clamp:3'),
        arrayUpdated: Array.isArray(state.styleArray) && hasStyleText('padding:8rpx'),
        nestedArrayUpdated: Array.isArray(state.styleNestedArray?.[1]) && hasStyleText('translate3d(1px, 0, 0)'),
        nullableUpdated: Array.isArray(state.styleNullable) && hasStyleText('#111827'),
        overrideUpdated: Array.isArray(state.styleOverride) && hasStyleText('#345678'),
        importantUpdated: Array.isArray(state.styleImportant) && hasStyleText('#ff4d4f !important'),
        cssVarUpdated: Array.isArray(state.styleCssVar) && hasStyleText('--chip-bg:#e6f4ff'),
        conditionalUpdated: state.isReady === true && hasStyleText('border-width:2rpx'),
      }

      const result = buildResult('style-matrix', checks, {
        styleBindingEntries,
        styleString: state.styleString,
        styleObject: state.styleObject,
        styleCamelObject: state.styleCamelObject,
        styleArray: state.styleArray,
        styleNestedArray: state.styleNestedArray,
        styleNullable: state.styleNullable,
        styleOverride: state.styleOverride,
        styleImportant: state.styleImportant,
        styleCssVar: state.styleCssVar,
        isReady: state.isReady,
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
    isReady: false,
    styleString: 'color:#1f2937;background-color:#f9fafb',
    styleObject: {
      fontSize: '24rpx',
      lineHeight: 1.4,
      borderRadius: '8rpx',
    } as Record<string, any>,
    styleCamelObject: {
      backgroundColor: '#fffbe6',
      marginTop: '8rpx',
      WebkitLineClamp: 2,
    } as Record<string, any>,
    styleArray: [
      'padding:4rpx',
      { marginTop: '6rpx', borderColor: '#d9d9d9' },
    ] as any[],
    styleNestedArray: [
      'display:block',
      [{ opacity: 0.95 }, [{ transform: 'translate3d(0, 0, 0)' }]],
    ] as any[],
    styleNullable: [
      null,
      undefined,
      false,
      '',
      { color: '#374151', marginBottom: null, padding: '2rpx' },
    ] as any[],
    styleOverride: [
      { color: '#111111' },
      'color:#222222',
      { color: '#333333' },
    ] as any[],
    styleImportant: [
      { color: '#f5222d !important' },
      'background-color:#f0f5ff',
    ] as any[],
    styleCssVar: [
      {
        '--chip-bg': '#f6ffed',
        '--chip-color': '#389e0d',
      },
      'color:var(--chip-color)',
      { backgroundColor: 'var(--chip-bg)' },
    ] as any[],
    readyStyle: {
      borderColor: '#1677ff',
      borderStyle: 'solid',
    } as Record<string, any>,
    idleStyle: {
      borderColor: '#d9d9d9',
      borderStyle: 'dashed',
    } as Record<string, any>,
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
      Style Matrix
    </view>
    <view class="summary">
      ok: {{ __e2e.ok }}
    </view>

    <view id="style-string" class="cell" :style="styleString">
      style-string
    </view>
    <view id="style-object" class="cell" :style="styleObject">
      style-object
    </view>
    <view id="style-camel" class="cell" :style="styleCamelObject">
      style-camel
    </view>
    <view id="style-array" class="cell" :style="styleArray">
      style-array
    </view>
    <view id="style-nested" class="cell" :style="styleNestedArray">
      style-nested
    </view>
    <view id="style-nullable" class="cell" :style="styleNullable">
      style-nullable
    </view>
    <view id="style-override" class="cell" :style="styleOverride">
      style-override
    </view>
    <view id="style-important" class="cell" :style="styleImportant">
      style-important
    </view>
    <view id="style-css-var" class="cell" :style="styleCssVar">
      style-css-var
    </view>
    <view
      id="style-conditional"
      class="cell"
      :style="[isReady ? readyStyle : idleStyle, { borderWidth: isReady ? '2rpx' : '1rpx' }]"
    >
      style-conditional
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

.cell {
  margin-top: 10rpx;
  border: 1rpx solid #e5e7eb;
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
