<script setup lang="ts">
import { ref } from 'wevu'
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

function togglePanelKind() {
  panelKind.value = panelKind.value === 'main' ? 'alt' : 'main'
}

function toggleTone() {
  tone.value = tone.value === 'neutral' ? 'success' : 'neutral'
}

function onPanelRun(payload: { at: string, title: string }) {
  logs.value = [`emit: ${payload.title} @ ${payload.at}`, ...logs.value].slice(0, 8)
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
      <ModelInput v-model="modelText" label="输入后将 trim + uppercase" />
      <text class="card-meta">
        modelText: {{ modelText }}
      </text>
      <text class="card-meta">
        说明：wevu 当前 defineModel 为单 Ref 形式，不是 Vue 的 tuple + modifiers 形式。
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
