<script setup lang="ts">
import { computed, ref } from 'wevu'
import NativeBadge from '../../../native/native-badge/index'
import NativeMeterTs from '../../../native/native-meter-ts/index'
import CompatAltPanel from '../components/CompatAltPanel.vue'
import CompatEmitMatrix from '../components/CompatEmitMatrix.vue'
import CompatPanel from '../components/CompatPanel.vue'
import ModelInput from '../components/ModelInput.vue'

definePageJson({
  navigationBarTitleText: 'Script Setup 宏对照',
})

type PanelKind = 'main' | 'alt'

const panelKind = ref<PanelKind>('main')
const tone = ref<'neutral' | 'success'>('neutral')
const modelText = ref('wevu model')
const logs = ref<string[]>([])
const nativeBadgeTypes = ['info', 'success', 'warning'] as const
const nativeBadgeIndex = ref(0)
const nativeMeterTones = ['neutral', 'success', 'danger'] as const
const nativeMeterToneIndex = ref(0)
const nativeMeterValue = ref(28)
const emitMatrixRecords = ref<Array<Record<string, any>>>([])

const nativeBadgeType = computed(() => {
  return nativeBadgeTypes[nativeBadgeIndex.value]
})
const nativeMeterTone = computed(() => {
  return nativeMeterTones[nativeMeterToneIndex.value]
})

function togglePanelKind() {
  panelKind.value = panelKind.value === 'main' ? 'alt' : 'main'
}

function toggleTone() {
  tone.value = tone.value === 'neutral' ? 'success' : 'neutral'
}

function onPanelRun(payload: { at: string, title: string }) {
  logs.value = [`emit: ${payload.title} @ ${payload.at}`, ...logs.value].slice(0, 8)
}

function onPanelRunEvent(payload: { type?: string, timeStamp?: number }) {
  const type = payload.type ?? 'unknown'
  const timeStamp = payload.timeStamp ?? 'n/a'
  logs.value = [`emit $event: ${type} @ ${timeStamp}`, ...logs.value].slice(0, 8)
}

function nextNativeBadgeType() {
  nativeBadgeIndex.value = (nativeBadgeIndex.value + 1) % nativeBadgeTypes.length
}

function nextNativeMeterTone() {
  nativeMeterToneIndex.value = (nativeMeterToneIndex.value + 1) % nativeMeterTones.length
}

function increaseNativeMeterValue() {
  nativeMeterValue.value = Math.min(100, nativeMeterValue.value + 12)
}

function resetNativeMeterValue() {
  nativeMeterValue.value = 28
}

function resetEmitMatrixRecords() {
  emitMatrixRecords.value = []
}

function pushEmitMatrixRecord(label: string, payload: any) {
  const baseRecord = {
    label,
    payloadType: payload == null
      ? String(payload)
      : Array.isArray(payload)
        ? 'array'
        : typeof payload,
  }

  if (Array.isArray(payload)) {
    emitMatrixRecords.value = [
      {
        ...baseRecord,
        first: payload[0],
        second: payload[1],
        thirdOk: payload[2]?.ok === true,
        tupleLength: payload.length,
      },
      ...emitMatrixRecords.value,
    ].slice(0, 12)
    return
  }

  if (payload && typeof payload === 'object') {
    emitMatrixRecords.value = [
      {
        ...baseRecord,
        detailType: payload.detail == null ? String(payload.detail) : typeof payload.detail,
        kind: payload.kind,
        marker: payload.detail?.marker,
        metaSource: payload.meta?.source,
        nativeType: payload.type,
        timeStampType: typeof payload.timeStamp,
        title: payload.title,
      },
      ...emitMatrixRecords.value,
    ].slice(0, 12)
    return
  }

  emitMatrixRecords.value = [
    {
      ...baseRecord,
      value: payload,
    },
    ...emitMatrixRecords.value,
  ].slice(0, 12)
}

function onEmitMatrixPayload(payload: {
  detail?: { marker?: string }
  kind: string
  meta: { source: string }
  title: string
}) {
  pushEmitMatrixRecord('payload-direct', payload)
}

function onEmitMatrixPayloadEvent(payload: {
  detail?: { marker?: string }
  kind: string
  meta: { source: string }
  title: string
}) {
  pushEmitMatrixRecord('payload-explicit-$event', payload)
}

function onEmitMatrixPayloadTitle(title: string) {
  pushEmitMatrixRecord('payload-inline-title', title)
}

function onEmitMatrixNative(payload: {
  detail?: Record<string, any>
  timeStamp?: number
  type?: string
}) {
  pushEmitMatrixRecord('native-direct', payload)
}

function onEmitMatrixNativeEvent(payload: {
  detail?: Record<string, any>
  timeStamp?: number
  type?: string
}) {
  pushEmitMatrixRecord('native-explicit-$event', payload)
}

function onEmitMatrixTuple(payload: [string, number, { ok: boolean }]) {
  pushEmitMatrixRecord('tuple-direct', payload)
}

function onEmitMatrixTupleEvent(payload: [string, number, { ok: boolean }]) {
  pushEmitMatrixRecord('tuple-explicit-$event', payload)
}

function onEmitMatrixEmpty(payload: undefined) {
  pushEmitMatrixRecord('empty-direct', payload)
}

function onEmitMatrixEmptyEvent(payload: undefined) {
  pushEmitMatrixRecord('empty-explicit-$event', payload)
}

function onEmitMatrixOptions(payload: {
  detail?: { marker?: string }
  kind: string
  meta: { source: string }
  title: string
}) {
  pushEmitMatrixRecord('options-direct', payload)
}

function onEmitMatrixOptionsEvent(payload: {
  detail?: { marker?: string }
  kind: string
  meta: { source: string }
  title: string
}) {
  pushEmitMatrixRecord('options-explicit-$event', payload)
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="title">
        Script Setup 宏能力
      </text>
      <text class="subtitle">
        defineProps / defineEmits / defineModel / withDefaults / defineExpose。
      </text>
    </view>

    <view class="section">
      <text class="section-title">
        defineModel + 修饰符
      </text>
      <ModelInput v-model.trim.uppercase="modelText" label="输入后将 trim + uppercase" />
      <text class="card-meta">
        modelText: {{ modelText }}
      </text>
      <text class="card-meta">
        说明：wevu 已支持 Vue 官方 defineModel tuple 形态，可解构出 modifiers 并配合泛型使用。
      </text>
    </view>

    <view class="section">
      <text class="section-title">
        script setup 引入原生组件
      </text>
      <view class="row">
        <NativeBadge :text="`状态：${nativeBadgeType}`" :type="nativeBadgeType" />
        <button class="btn light" @tap="nextNativeBadgeType">
          切换状态
        </button>
      </view>
      <text class="card-meta">
        示例：直接在 script setup 中 `import NativeBadge from '../../../native/native-badge/index'`。
      </text>
      <text class="card-meta">
        说明：`NativeBadge` 的 props 类型由同目录 d.ts 提供，模板里 `text/type` 都有智能提示。
      </text>
    </view>

    <view class="section">
      <text class="section-title">
        script setup 引入 TS + SCSS 原生组件
      </text>
      <NativeMeterTs
        label="构建链能力"
        :value="nativeMeterValue"
        :tone="nativeMeterTone"
      />
      <view class="row">
        <button class="btn light" @tap="increaseNativeMeterValue">
          增加进度
        </button>
        <button class="btn light" @tap="nextNativeMeterTone">
          切换 tone（{{ nativeMeterTone }}）
        </button>
        <button class="btn light" @tap="resetNativeMeterValue">
          重置
        </button>
      </view>
      <text class="card-meta">
        当前 value = {{ nativeMeterValue }}，tone = {{ nativeMeterTone }}。
      </text>
      <text class="card-meta">
        示例：`NativeMeterTs` 来自 `src/native/native-meter-ts/index.ts + index.scss`，由当前页面 script setup 直接 import。
      </text>
    </view>

    <view class="section">
      <text class="section-title">
        defineProps / defineEmits / slots / 动态组件
      </text>
      <view class="row">
        <button class="btn" @tap="togglePanelKind">
          切换组件（{{ panelKind }}）
        </button>
        <button class="btn secondary" @tap="toggleTone">
          切换 tone（{{ tone }}）
        </button>
      </view>

      <CompatPanel
        v-if="panelKind === 'main'"
        title="Script Setup 面板"
        description="父组件传入 props，子组件 emit run 事件"
        :tone="tone"
        mode="compare"
        @run="onPanelRun"
      >
        <template #head>
          <text class="card-title">
            命名插槽 head（父级提供）
          </text>
        </template>

        <text class="card-meta">
          默认插槽内容：当前 panelKind = {{ panelKind }}
        </text>

        <template #foot>
          <text class="card-meta">
            命名插槽 foot（仅主面板会展示）
          </text>
        </template>
      </CompatPanel>

      <CompatAltPanel
        v-else
        title="Alt Script Setup 面板"
        @run="onPanelRun"
        @runevent="onPanelRunEvent"
      />

      <text class="card-meta">
        说明：`component :is` + 跨文件 `.vue` 组件在当前 wevu 构建链下会触发缺省导出问题，此处改为 v-if/v-else 对照。
      </text>
    </view>

    <view class="section">
      <text class="section-title">
        emit / $event 观察矩阵
      </text>
      <button id="emit-matrix-reset" class="btn light" @tap="resetEmitMatrixRecords">
        清空矩阵记录
      </button>
      <CompatEmitMatrix
        prefix="emit-direct"
        title="写法 A: direct handler"
        @payload="onEmitMatrixPayload"
        @native="onEmitMatrixNative"
        @tuple="onEmitMatrixTuple"
        @empty="onEmitMatrixEmpty"
        @options="onEmitMatrixOptions"
      />
      <CompatEmitMatrix
        prefix="emit-explicit"
        title="写法 B: explicit $event"
        @payload="onEmitMatrixPayloadEvent($event)"
        @native="onEmitMatrixNativeEvent($event)"
        @tuple="onEmitMatrixTupleEvent($event)"
        @empty="onEmitMatrixEmptyEvent($event)"
        @options="onEmitMatrixOptionsEvent($event)"
      />
      <CompatEmitMatrix
        prefix="emit-inline"
        title="写法 C: inline $event.title"
        @payload="onEmitMatrixPayloadTitle($event.title)"
      />
      <view class="card-list">
        <view v-for="(item, index) in emitMatrixRecords" :key="`emit-matrix-${index}`" class="card">
          <text class="card-meta">
            {{ JSON.stringify(item) }}
          </text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">
        事件日志
      </text>
      <view class="card-list">
        <view v-for="(line, index) in logs" :key="index" class="card">
          <text class="card-meta">
            {{ line }}
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
@import '../shared.css';
</style>
