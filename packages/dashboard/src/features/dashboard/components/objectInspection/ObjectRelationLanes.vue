<script setup lang="ts">
import type { InspectionNode } from '../../utils/objectInspection'
import { computed, onMounted, useTemplateRef, watch } from 'vue'
import { resolveInspectionRelationTargets } from '../../utils/objectInspection'
import ObjectRelationLane from './ObjectRelationLane.vue'
import RelationConnections from './RelationConnections.vue'

const props = defineProps<{
  packages: InspectionNode[]
  artifacts: InspectionNode[]
  modules: InspectionNode[]
  packageQuery: string
  artifactQuery: string
  moduleQuery: string
  selected: InspectionNode | null
}>()
const emit = defineEmits<{
  'select': [node: InspectionNode]
  'update:packageQuery': [value: string]
  'update:artifactQuery': [value: string]
  'update:moduleQuery': [value: string]
}>()
const laneRefs = useTemplateRef<Array<InstanceType<typeof ObjectRelationLane>>>('laneRefs')
const lanes = computed(() => [
  { key: 'packages' as const, title: '包', query: props.packageQuery, all: props.packages },
  { key: 'artifacts' as const, title: '产物', query: props.artifactQuery, all: props.artifacts },
  { key: 'modules' as const, title: '模块落点', query: props.moduleQuery, all: props.modules },
])
const edges = computed(() => {
  const packageNodes = new Map(props.packages.map(node => [node.target.packageId, node]))
  const artifactNodes = new Map(props.artifacts.map(node => [node.key, node]))
  return [
    ...props.artifacts.flatMap((artifact) => {
      const pkg = packageNodes.get(artifact.target.packageId)
      return pkg ? [{ from: pkg.key, to: artifact.key, active: props.selected?.artifactKey === artifact.key || props.selected?.key === pkg.key }] : []
    }),
    ...props.modules.flatMap((module) => {
      const artifact = module.artifactKey ? artifactNodes.get(module.artifactKey) : undefined
      return artifact ? [{ from: artifact.key, to: module.key, active: props.selected?.key === module.key || props.selected?.key === artifact.key }] : []
    }),
  ]
})

function setQuery(key: (typeof lanes.value)[number]['key'], value: string) {
  if (key === 'packages') {
    emit('update:packageQuery', value)
  }
  else if (key === 'artifacts') {
    emit('update:artifactQuery', value)
  }
  else {
    emit('update:moduleQuery', value)
  }
}

/** 定位仅滚动相关列，不清除用户显式筛选，也不改变目标。 */
function locateSelection() {
  for (const node of resolveInspectionRelationTargets(props, props.selected)) {
    for (const component of laneRefs.value ?? []) {
      component.reveal(node.key)
    }
  }
}

watch(() => props.selected?.key, locateSelection, { flush: 'post' })
onMounted(locateSelection)
</script>

<template>
  <div>
    <div class="relation-grid">
      <RelationConnections :edges="edges" />
      <ObjectRelationLane
        v-for="(lane, index) in lanes" :key="lane.key" ref="laneRefs" :title="lane.title" :number="`0${index + 1}`"
        :items="lane.all" :total="lane.all.length" :query="lane.query" :selected-key="selected?.key ?? null"
        @select="emit('select', $event)" @query="setQuery(lane.key, $event)"
      />
    </div>
    <footer class="relation-caption">
      <span><span class="legend-line" />报告收录与归属，不表示 import 或调用。滚动或搜索浏览全部对象。</span>
      <button type="button" :disabled="!selected" @click="locateSelection">定位当前对象</button>
    </footer>
  </div>
</template>

<style scoped>
.relation-grid {
  position: relative;
  display: grid;
  grid-template-columns: minmax(140px, 0.7fr) minmax(190px, 1fr) minmax(220px, 1.15fr);
  gap: 42px;
}

.relation-caption {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 12px;
  color: var(--dashboard-text-soft);
}

.legend-line {
  display: inline-block;
  width: 20px;
  height: 1px;
  margin-right: 8px;
  vertical-align: 4px;
  background: var(--dashboard-accent);
}

.relation-caption button {
  min-height: 38px;
  padding: 6px 10px;
  color: var(--dashboard-accent);
  background: transparent;
  border: 1px solid var(--dashboard-border);
  border-radius: 6px;
}

@media (max-width: 1050px) {
  .relation-grid {
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1.1fr);
    gap: 24px;
  }
}

@media (max-width: 760px) {
  .relation-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
}
</style>
