<script setup lang="ts">
import type { BuiltInScenario } from '../scenarios'
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
        class="sim-scene-btn"
        :class="{ 'is-active': activeId === scenario.id }"
        @click="emit('pick', scenario.id)"
      >
        <strong>{{ scenario.name }}</strong>
        <span>{{ scenario.description }}</span>
      </button>
    </div>
    <label class="sim-import-btn" :class="{ 'is-loading': loading }">
      <span class="sim-import-btn__title">🕛 导入目录</span>
      <span class="sim-import-btn__hint">选择包含 app.json / app.js / pages 的构建目录。</span>
      <input
        type="file"
        multiple
        webkitdirectory
        @change="emit('pickDirectory', $event)"
      >
    </label>
  </SectionCard>
</template>
