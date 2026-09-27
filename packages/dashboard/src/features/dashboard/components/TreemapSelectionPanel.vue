<script setup lang="ts">
import type { AnalyzeSubpackagesResult, TreemapNode, TreemapNodeMeta } from '../types'
import { computed, nextTick, shallowRef, watch } from 'vue'
import { useTreemapDetailSections } from '../composables/useTreemapDetailSections'
import { formatSignedBytes } from '../utils/sourceCompareSummary'
import {
  createTreemapDetailContext,
  createTreemapDetailReport,
  findDetailModule,
  formatDetailBytes,
  getDetailKind,
  getDetailPath,
  getDetailSize,
  getDetailSourceState,
} from '../utils/treemapDetails/context'
import { createTreemapDetailSections, createTreemapImportIndex } from '../utils/treemapDetails/references'
import TreemapDetailGroup from './TreemapDetailGroup.vue'

const props = defineProps<{
  result: AnalyzeSubpackagesResult
  nodes: TreemapNode[]
  selectedMeta: TreemapNodeMeta | null
}>()

const emit = defineEmits<{
  selectNode: [meta: TreemapNodeMeta]
  openSource: [meta: TreemapNodeMeta]
}>()

const query = shallowRef('')
const panel = shallowRef<HTMLElement | null>(null)
const identityHeader = shallowRef<HTMLElement | null>(null)
const heading = shallowRef<HTMLHeadingElement | null>(null)
const report = computed(() => createTreemapDetailReport(props.result))
const context = computed(() => createTreemapDetailContext(report.value, props.nodes))
const imports = computed(() => createTreemapImportIndex(report.value))
const sectionState = useTreemapDetailSections({
  report: () => report.value,
  imports: () => imports.value,
  selectedMeta: () => props.selectedMeta,
})
const details = computed(() => {
  const meta = props.selectedMeta
  if (!meta) {
    return null
  }
  return {
    path: getDetailPath(context.value, meta),
    kind: getDetailKind(meta),
    size: getDetailSize(context.value, meta),
    module: findDetailModule(context.value, meta),
    source: getDetailSourceState(context.value, meta),
    outsideFilter: !context.value.tree.has(meta.nodeId),
  }
})
const identityLabel = computed(() => {
  if (!props.selectedMeta || !details.value) {
    return '按包浏览产物与模块'
  }
  return props.selectedMeta.kind === 'package'
    ? props.selectedMeta.packageLabel
    : details.value.path.split(/[\\/]/).pop() || details.value.path
})
const sections = computed(() => createTreemapDetailSections(context.value, imports.value, props.nodes, props.selectedMeta))
const filteredSections = computed(() => {
  const search = query.value.trim().toLowerCase()
  return sections.value.map(section => ({
    ...section,
    rows: search ? section.rows.filter(row => `${row.path} ${row.description}`.toLowerCase().includes(search)) : section.rows,
  }))
})
const visibleCount = computed(() => filteredSections.value.reduce((count, section) => count + section.rows.length, 0))
const totalCount = computed(() => sections.value.reduce((count, section) => count + section.rows.length, 0))

watch(() => props.selectedMeta?.nodeId, () => {
  query.value = ''
})

function findScrollContainer(element: HTMLElement): HTMLElement {
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(current).overflowY)) {
      return current
    }
  }
  return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : document.documentElement
}

function getScrollBounds(container: HTMLElement) {
  if (container === document.scrollingElement) {
    return { top: 0, bottom: window.innerHeight }
  }
  const rect = container.getBoundingClientRect()
  return {
    top: Math.max(0, rect.top + container.clientTop),
    bottom: Math.min(window.innerHeight, rect.top + container.clientTop + container.clientHeight),
  }
}

let disclosureRequest = 0

async function toggleSection(id: string, element: HTMLElement) {
  const request = ++disclosureRequest
  const selectedId = props.selectedMeta?.nodeId
  const container = findScrollContainer(element)
  const scrollTop = container.scrollTop
  const opening = !sectionState.isOpen(id)
  sectionState.setOpen(id, opening)
  if (!opening) {
    return
  }
  await nextTick()
  if (request !== disclosureRequest || selectedId !== props.selectedMeta?.nodeId
    || !element.isConnected || !sectionState.isOpen(id) || Math.abs(container.scrollTop - scrollTop) > 1) {
    return
  }
  const bounds = getScrollBounds(container)
  const rect = element.getBoundingClientRect()
  if (rect.bottom <= bounds.bottom) {
    return
  }
  const top = Math.max(bounds.top, identityHeader.value?.getBoundingClientRect().bottom ?? bounds.top)
  container.scrollTo({ top: container.scrollTop + rect.top - top, behavior: 'instant' })
}

async function selectNode(meta: TreemapNodeMeta) {
  disclosureRequest++
  emit('selectNode', meta)
  await nextTick()
  heading.value?.focus({ preventScroll: true })
  if (panel.value) {
    const container = findScrollContainer(panel.value)
    const top = container === panel.value
      ? 0
      : container.scrollTop + panel.value.getBoundingClientRect().top - getScrollBounds(container).top
    container.scrollTo({ top, behavior: 'instant' })
  }
}
</script>

<template>
  <section ref="panel" aria-label="节点详情与导航" class="min-w-0 text-sm text-(--dashboard-text) [&_:is(button,input)]:scroll-mt-24">
    <header ref="identityHeader" class="sticky top-0 z-10 -mx-4 -mt-4 border-b border-(--dashboard-border) bg-(--dashboard-panel) px-4 py-3">
      <h3 ref="heading" tabindex="-1" class="flex min-w-0 items-baseline gap-2 rounded-sm text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)">
        <span class="shrink-0">{{ details ? '节点详情' : '浏览构建产物' }}</span>
        <span v-if="selectedMeta" class="truncate text-xs font-normal text-(--dashboard-text-soft)" :title="selectedMeta.packageLabel">{{ selectedMeta.packageLabel }}</span>
      </h3>
      <p class="mt-1 truncate font-mono text-xs text-(--dashboard-text-muted)" :title="details?.path">
        {{ identityLabel }}
      </p>
    </header>
    <div class="mt-4 min-w-0 border-b border-(--dashboard-border) pb-4">
      <template v-if="selectedMeta && details">
        <p class="mt-2 font-mono text-xs leading-5 [overflow-wrap:anywhere]">
          {{ details.path }}
        </p>
        <dl class="mt-3 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs leading-5">
          <dt class="text-(--dashboard-text-soft)">
            类型
          </dt>
          <dd class="[overflow-wrap:anywhere]">
            {{ details.kind }}
          </dd>
          <dt class="text-(--dashboard-text-soft)">
            所属包
          </dt>
          <dd class="[overflow-wrap:anywhere]">
            {{ selectedMeta.packageLabel }} · {{ selectedMeta.packageId }}
          </dd>
          <template v-if="selectedMeta.kind === 'module' || selectedMeta.kind === 'asset'">
            <dt class="text-(--dashboard-text-soft)">
              所在产物
            </dt>
            <dd class="font-mono [overflow-wrap:anywhere]">
              {{ selectedMeta.fileName }}
            </dd>
          </template>
          <template v-if="details.module && details.module.id !== details.path">
            <dt class="text-(--dashboard-text-soft)">
              模块 ID
            </dt>
            <dd class="font-mono [overflow-wrap:anywhere]">
              {{ details.module.id }}
            </dd>
          </template>
          <dt class="text-(--dashboard-text-soft)">
            {{ selectedMeta.kind === 'module' ? '模块贡献' : '实际产物体积' }}
          </dt>
          <dd class="tabular-nums [overflow-wrap:anywhere]">
            {{ details.size.text }}
          </dd>
          <template v-if="details.module?.originalBytes !== undefined">
            <dt class="text-(--dashboard-text-soft)">
              原始模块体积
            </dt>
            <dd class="tabular-nums">
              {{ formatDetailBytes(details.module.originalBytes) }}
            </dd>
          </template>
          <template v-if="selectedMeta.colorLabel">
            <dt class="text-(--dashboard-text-soft)">
              着色依据
            </dt>
            <dd class="[overflow-wrap:anywhere]">
              {{ selectedMeta.colorLabel }}
            </dd>
          </template>
          <template v-if="selectedMeta.deltaBytes !== undefined">
            <dt class="text-(--dashboard-text-soft)">
              相对基线
            </dt>
            <dd class="tabular-nums">
              {{ formatSignedBytes(selectedMeta.deltaBytes) }}
            </dd>
          </template>
        </dl>
        <p v-if="selectedMeta.kind === 'module'" class="mt-3 text-xs leading-5 text-(--dashboard-text-soft)">
          模块贡献来自打包器记录，不等于独立产物大小。缺失时图块面积使用原始模块体积估算；两者均缺失时仅作占位。
        </p>
        <p v-if="selectedMeta.kind === 'module' && !details.module" class="mt-3 text-xs leading-5 text-(--dashboard-text-soft)">
          报告中未找到与此节点 ID 匹配的模块，无法确认完整源码路径与跨包位置。
        </p>
        <p v-if="details.outsideFilter" class="mt-3 text-xs leading-5 text-(--dashboard-text-soft)">
          此节点不在当前图表筛选中；详情仍使用完整分析报告。调整筛选可在图中查看。
        </p>
        <button
          v-if="selectedMeta.kind !== 'package' && details.source.available"
          type="button"
          class="mt-3 min-h-9 rounded-md border border-(--dashboard-border) px-3 text-xs font-medium text-(--dashboard-accent) hover:bg-(--dashboard-accent-soft) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
          @click="emit('openSource', selectedMeta)"
        >
          查看源码与产物
        </button>
        <p v-else class="mt-3 text-xs leading-5 text-(--dashboard-text-soft)">
          {{ details.source.message }}
        </p>
      </template>
      <p v-else class="mt-2 text-xs leading-5 text-(--dashboard-text-soft)">
        从包进入产物、模块或资源；下方按钮与图块选择同步，无需操作画布。
      </p>
    </div>

    <div class="mt-4 min-w-0">
      <label class="block text-xs text-(--dashboard-text-soft)">
        搜索当前列表
        <input
          v-model="query"
          type="search"
          autocomplete="off"
          placeholder="输入路径、包名或引用名称"
          class="mt-2 min-h-9 w-full min-w-0 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-3 text-xs text-(--dashboard-text) placeholder:text-(--dashboard-text-soft) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
        >
      </label>
      <p aria-live="polite" class="mt-2 text-xs text-(--dashboard-text-soft)">
        {{ visibleCount }} / {{ totalCount }} 项 · 按已记录体积从大到小
      </p>
      <p v-if="query.trim() && !visibleCount" class="mt-3 text-xs leading-5 text-(--dashboard-text-soft)">
        当前列表没有匹配结果；清空搜索可查看全部条目。
      </p>
      <TreemapDetailGroup
        v-for="section in filteredSections"
        :key="section.id"
        :section="section"
        :open="sectionState.isOpen(section.id)"
        :unread="sectionState.hasUnread(section.id)"
        :searching="Boolean(query.trim())"
        @toggle="toggleSection"
        @select-node="selectNode"
      />
      <p v-if="selectedMeta?.kind === 'file' || selectedMeta?.kind === 'module'" class="mt-4 text-[11px] leading-5 text-(--dashboard-text-soft)">
        引用仅来自构建产物的静态 / 动态 import 记录；模块位置不是源码级依赖关系。
      </p>
    </div>
  </section>
</template>
