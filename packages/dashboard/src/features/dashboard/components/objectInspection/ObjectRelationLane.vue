<script setup lang="ts">
import type { InspectionNode } from '../../utils/objectInspection'
import { useTemplateRef, watch } from 'vue'
import { formatBytes } from '../../utils/format'

const props = defineProps<{
  title: string
  number: string
  items: InspectionNode[]
  total: number
  query: string
  selectedKey: string | null
}>()
const emit = defineEmits<{
  select: [node: InspectionNode]
  query: [value: string]
}>()
const list = useTemplateRef<HTMLElement>('list')

watch(() => props.query, () => {
  list.value?.scrollTo({ top: 0 })
}, { flush: 'post' })

/** 只滚动本列，不移动页面或清除显式筛选。 */
function reveal(key: string) {
  const container = list.value
  const node = Array.from(container?.querySelectorAll<HTMLElement>('[data-node-key]') ?? [])
    .find(element => element.dataset.nodeKey === key)
  if (container && node) {
    container.scrollTop = node.offsetTop - (container.clientHeight - node.offsetHeight) / 2
  }
}

defineExpose({ reveal })
</script>

<template>
  <section class="relation-lane" :aria-label="title">
    <header class="lane-heading">
      <h3><span class="lane-number">{{ number }}</span>{{ title }} <span class="lane-count">{{ total }}</span></h3>
      <label class="lane-search">
        <span class="sr-only">搜索{{ title }}</span>
        <input :value="query" type="search" :placeholder="`搜索${title}路径或名称`" @input="emit('query', ($event.target as HTMLInputElement).value)">
      </label>
    </header>
    <div ref="list" class="lane-nodes" tabindex="0" :aria-label="`${title}列表，可滚动浏览`">
      <button
        v-for="node in items" :key="node.key" type="button" class="relation-node"
        :data-node-key="node.key" :aria-pressed="node.key === selectedKey"
        :title="`${node.packageLabel} · ${node.target.kind === 'module' ? `${node.target.file} · ` : ''}${node.label}`" @click="emit('select', node)"
      >
        <span class="node-type">
          <span>{{ node.target.kind === 'package' ? 'PACKAGE' : node.sourceType }}</span>
          <span class="node-context">{{ node.target.kind === 'module' ? `${node.packageLabel} / ${node.target.file}` : node.target.kind === 'artifact' ? node.packageLabel : node.target.packageId }}</span>
          <span v-if="node.key === selectedKey" class="selected-marker">当前对象</span>
        </span>
        <code class="node-path">{{ node.label }}</code>
        <span class="node-facts">
          <span v-if="node.target.kind === 'module'">归因 {{ node.measurements.attributedBytes === null ? '未测量' : formatBytes(node.measurements.attributedBytes) }}</span>
          <strong v-else>{{ node.measurements.rawBytes === null ? '体积未测量' : formatBytes(node.measurements.rawBytes) }}</strong>
          <span v-if="node.target.kind !== 'module'">{{ node.moduleCount }} 模块落点</span>
          <span v-else>{{ node.sourcePath ? '源码可请求' : '源码不可读' }}</span>
        </span>
      </button>
      <p v-if="!items.length" class="lane-empty" role="status">没有匹配的{{ title }}。可清除搜索或更换包范围。</p>
    </div>
  </section>
</template>

<style scoped>
.relation-lane {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.lane-heading {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
}

.lane-heading h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
}

.lane-number {
  margin-right: 9px;
  font-family: var(--dashboard-code);
  color: var(--dashboard-accent);
}

.lane-count {
  margin-left: 6px;
  color: var(--dashboard-text-soft);
}

.lane-search input {
  width: 100%;
  min-width: 0;
  height: 38px;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--dashboard-text);
  background: var(--dashboard-bg);
  border: 1px solid var(--dashboard-border);
  border-radius: 6px;
}

.lane-nodes {
  position: relative;
  display: grid;
  gap: 4px;
  align-content: start;
  max-height: 392px;
  padding: 4px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-color: var(--dashboard-border-strong) transparent;
  scrollbar-width: thin;
}

.relation-node {
  display: flex;
  flex-direction: column;
  gap: 3px;
  justify-content: center;
  width: 100%;
  min-height: 76px;
  padding: 8px;
  color: var(--dashboard-text);
  text-align: left;
  background: var(--dashboard-panel);
  border: 1px solid transparent;
  border-radius: 4px;
  transition: border-color 120ms, background-color 120ms;
}

.relation-node:hover {
  background: var(--dashboard-panel-muted);
  border-color: var(--dashboard-border-strong);
}

.relation-node[aria-pressed='true'] {
  background: var(--dashboard-accent-soft);
  border-color: var(--dashboard-accent);
  box-shadow: inset 3px 0 var(--dashboard-accent);
}

.node-type,
.node-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  justify-content: space-between;
  font-size: 12px;
  color: var(--dashboard-text-muted);
}

.node-type {
  flex-wrap: nowrap;
  align-items: baseline;
}

.node-type > span:not(.node-context) {
  flex-shrink: 0;
}

.selected-marker {
  color: var(--dashboard-accent);
}

.node-path {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-family: var(--dashboard-code);
  font-size: 13px;
  line-height: 1.4;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
}

.node-facts strong {
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--dashboard-text);
}

.node-context {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--dashboard-text-soft);
  white-space: nowrap;
}

.lane-empty {
  padding: 24px 12px;
  margin: 0;
  font-size: 13px;
  color: var(--dashboard-text-muted);
  border: 1px dashed var(--dashboard-border);
  border-radius: 6px;
}

@media (max-width: 760px) {
  .lane-nodes {
    max-height: 320px;
  }

  .relation-node {
    min-height: 76px;
  }

  .node-path {
    display: block;
  }

  .node-context {
    overflow-wrap: anywhere;
    white-space: normal;
  }
}

@media (prefers-reduced-motion: reduce) {
  .relation-node {
    transition: none;
  }
}
</style>
