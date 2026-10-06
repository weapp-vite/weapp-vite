<script setup lang="ts">
import type { InspectionNode } from '../../utils/objectInspection'
import { computed, reactive, watch } from 'vue'
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
const pages = reactive({ packages: 1, artifacts: 1, modules: 1 })
const pageSize = 3
const lanes = computed(() => [
  { key: 'packages' as const, title: '包', query: props.packageQuery, all: props.packages },
  { key: 'artifacts' as const, title: '产物', query: props.artifactQuery, all: props.artifacts },
  { key: 'modules' as const, title: '模块落点', query: props.moduleQuery, all: props.modules },
].map(lane => ({
  ...lane,
  pageCount: Math.max(1, Math.ceil(lane.all.length / pageSize)),
  items: lane.all.slice((pages[lane.key] - 1) * pageSize, pages[lane.key] * pageSize),
})))
const edges = computed(() => {
  const packageNodes = lanes.value[0]!.items
  const artifacts = lanes.value[1]!.items
  const modules = lanes.value[2]!.items
  return [
    ...artifacts.flatMap((artifact) => {
      const pkg = packageNodes.find(node => node.target.packageId === artifact.target.packageId)
      return pkg ? [{ from: pkg.key, to: artifact.key, active: props.selected?.artifactKey === artifact.key || props.selected?.key === pkg.key }] : []
    }),
    ...modules.flatMap((module) => {
      const artifact = artifacts.find(node => node.key === module.artifactKey)
      return artifact ? [{ from: artifact.key, to: module.key, active: props.selected?.key === module.key || props.selected?.key === artifact.key }] : []
    }),
  ]
})

watch(() => [props.packages, props.artifacts, props.modules], () => {
  for (const lane of lanes.value) {
    pages[lane.key] = Math.min(pages[lane.key], lane.pageCount)
  }
})
watch(() => props.packageQuery, () => {
  pages.packages = 1
})
watch(() => props.artifactQuery, () => {
  pages.artifacts = 1
})
watch(() => props.moduleQuery, () => {
  pages.modules = 1
})

function setPage(key: keyof typeof pages, value: number) {
  const lane = lanes.value.find(item => item.key === key)!
  if (Number.isFinite(value)) {
    pages[key] = Math.max(1, Math.min(lane.pageCount, Math.trunc(value)))
  }
}

function setQuery(key: keyof typeof pages, value: string) {
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

/** 定位只翻页，不清除用户显式筛选，也不改变目标。 */
function locateSelection() {
  for (const lane of lanes.value) {
    const index = lane.all.findIndex(node => node.key === props.selected?.key
      || node.key === props.selected?.artifactKey
      || (node.target.kind === 'package' && node.target.packageId === props.selected?.target.packageId))
    if (index >= 0) {
      pages[lane.key] = Math.floor(index / pageSize) + 1
    }
  }
}
</script>

<template>
  <div>
    <div class="relation-grid">
      <RelationConnections :edges="edges" />
      <ObjectRelationLane
        v-for="(lane, index) in lanes" :key="lane.key" :title="lane.title" :number="`0${index + 1}`"
        :items="lane.items" :total="lane.all.length" :page="pages[lane.key]" :pages="lane.pageCount"
        :query="lane.query" :selected-key="selected?.key ?? null"
        @select="emit('select', $event)" @query="setQuery(lane.key, $event)" @page="setPage(lane.key, $event)"
      />
    </div>
    <footer class="relation-caption">
      <span><span class="legend-line" />报告收录与归属，不表示 import 或调用。每列独立分页。</span>
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
