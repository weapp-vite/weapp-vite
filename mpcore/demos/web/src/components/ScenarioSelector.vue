<script setup lang="ts">
import type { BuiltInScenario } from '../scenarios'
import { dropzoneCard, labelClass, mutedTextClass, sceneButton } from '../lib/ui'
import SectionCard from './SectionCard.vue'

defineProps<{
  activeId: string
  loading: boolean
  scenarios: BuiltInScenario[]
}>()

const emit = defineEmits<{
  pick: [scenarioId: string]
  pickDirectory: [event: Event]
}>()
</script>

<template>
  <SectionCard title="🕛 场景" subtitle="内置样例和本地构建目录都从这里进入。">
    <div class="sim-scene-grid">
      <button
        v-for="scenario in scenarios"
        :key="scenario.id"
        :class="sceneButton({ active: activeId === scenario.id })"
        @click="emit('pick', scenario.id)"
      >
        <strong class="text-[15px] font-semibold tracking-tight text-[color:var(--sim-text)]">
          {{ scenario.name }}
        </strong>
        <span :class="mutedTextClass">{{ scenario.description }}</span>
      </button>
    </div>
    <label :class="dropzoneCard()">
      <span class="text-[14px] font-semibold tracking-tight text-[color:var(--sim-text)]">🕛 导入目录</span>
      <span :class="labelClass">
        {{ loading ? '正在解析目录...' : '选择包含 app.json / app.js / pages 的构建目录。' }}
      </span>
      <input
        class="absolute inset-0 cursor-pointer opacity-0"
        type="file"
        multiple
        webkitdirectory
        @change="emit('pickDirectory', $event)"
      >
    </label>
  </SectionCard>
</template>
