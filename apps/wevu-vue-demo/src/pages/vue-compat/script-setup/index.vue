<script setup lang="ts">
import { computed, ref } from 'wevu'
import NativeBadge from '../../../native/native-badge/index'
import NativeMeterTs from '../../../native/native-meter-ts/index'
import CompatAltPanel from '../components/CompatAltPanel.vue'
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
