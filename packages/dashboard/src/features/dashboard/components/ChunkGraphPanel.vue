<script setup lang="ts">
import type {
  D3DragEvent,
  SimulationLinkDatum,
  SimulationNodeDatum,
  ZoomBehavior,
} from 'd3'
import type { AnalyzeSubpackagesResult, ResolvedTheme } from '../types'
import type { AnalyzeChunkGraphEdge, AnalyzeChunkGraphNode } from '../utils/analyzeChunkGraph'
import {
  drag,
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  select,
  zoom,
  zoomIdentity,
  zoomTransform,
} from 'd3'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { createAnalyzeChunkGraph, createAnalyzeChunkGraphView } from '../utils/analyzeChunkGraph'
import { formatBytes } from '../utils/format'
import AppSelect from './AppSelect.vue'

interface RenderedGraphNode extends SimulationNodeDatum {
  color: string
  graphNode: AnalyzeChunkGraphNode
  id: string
  radius: number
}

interface RenderedGraphLink extends SimulationLinkDatum<RenderedGraphNode> {
  graphEdge: AnalyzeChunkGraphEdge
  source: string | RenderedGraphNode
  target: string | RenderedGraphNode
}

const props = defineProps<{
  result: AnalyzeSubpackagesResult
  theme: ResolvedTheme
}>()

const MAX_VISIBLE_NODES = 220
const MAX_VISIBLE_EDGES = 900
const MAX_SEARCH_NODES = 80
const svgRef = shallowRef<SVGSVGElement>()
const packageFilter = ref('all')
const searchQuery = ref('')
const selectedNodeId = ref<string | null>(null)
let resizeObserver: ResizeObserver | undefined
let simulation: ReturnType<typeof forceSimulation<RenderedGraphNode>> | undefined
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | undefined

const graph = computed(() => createAnalyzeChunkGraph(props.result))
const packageOptions = computed(() => graph.value.nodes.filter(node => node.kind === 'package'))
const packageFilterOptions = computed(() => [
  { label: '全部 package', value: 'all' },
  ...packageOptions.value.map(option => ({
    label: option.packageLabel,
    value: option.packageId,
  })),
])
const visibleGraph = computed(() => createAnalyzeChunkGraphView(graph.value, {
  maxEdges: searchQuery.value.trim() ? 320 : MAX_VISIBLE_EDGES,
  maxNodes: searchQuery.value.trim() ? MAX_SEARCH_NODES : MAX_VISIBLE_NODES,
  packageId: packageFilter.value,
  query: searchQuery.value,
}))
const selectedNode = computed(() => visibleGraph.value.nodes.find(node => node.id === selectedNodeId.value) ?? null)
const visibleNodeById = computed(() => new Map(visibleGraph.value.nodes.map(node => [node.id, node])))
const selectedImportEdges = computed(() => {
  const node = selectedNode.value
  if (!node) {
    return []
  }
  return visibleGraph.value.edges
    .filter(edge => (
      edge.kind !== 'contains'
      && (edge.source === node.id || edge.target === node.id)
    ))
    .map((edge) => {
      const outgoing = edge.source === node.id
      const relatedNode = visibleNodeById.value.get(outgoing ? edge.target : edge.source)
      return {
        id: edge.id,
        kind: edge.kind === 'dynamic-import' ? '动态' : '静态',
        label: relatedNode?.label ?? (outgoing ? edge.target : edge.source),
        relation: outgoing ? '导入' : '被导入',
      }
    })
})

const packageColorById = computed(() => {
  const palette = props.theme === 'dark'
    ? ['#5eead4', '#a78bfa', '#60a5fa', '#fbbf24', '#fb7185', '#34d399', '#f472b6', '#c4b5fd']
    : ['#0f766e', '#7c3aed', '#2563eb', '#b45309', '#be123c', '#047857', '#be185d', '#6d28d9']
  return new Map(packageOptions.value.map((node, index) => [node.packageId, palette[index % palette.length] ?? '#64748b']))
})

function formatPackageLabel(value: string) {
  return value.length > 20 ? `${value.slice(0, 19)}…` : value
}

function resolveLinkNode(
  value: string | RenderedGraphNode,
  nodeById: Map<string, RenderedGraphNode>,
) {
  return typeof value === 'string' ? nodeById.get(value) : value
}

function resolveNodeStrokeWidth(node: RenderedGraphNode) {
  return node.graphNode.kind === 'package' ? 3 : node.graphNode.isEntry ? 2.5 : 1.5
}

function selectNode(node: RenderedGraphNode) {
  selectedNodeId.value = node.id
}

function bindNodeDrag(
  event: D3DragEvent<SVGGElement, RenderedGraphNode, RenderedGraphNode>,
  node: RenderedGraphNode,
  phase: 'end' | 'start' | 'update',
) {
  if (phase === 'start') {
    if (!event.active) {
      simulation?.alphaTarget(0.18).restart()
    }
    node.fx = node.x
    node.fy = node.y
    return
  }
  if (phase === 'update') {
    node.fx = event.x
    node.fy = event.y
    return
  }
  if (!event.active) {
    simulation?.alphaTarget(0)
  }
  node.fx = null
  node.fy = null
}

function zoomGraph(factor: number) {
  if (svgRef.value && zoomBehavior) {
    select(svgRef.value).call(zoomBehavior.scaleBy, factor)
  }
}

function panGraph(x: number, y: number) {
  if (svgRef.value && zoomBehavior) {
    select(svgRef.value).call(zoomBehavior.translateBy, x, y)
  }
}

function resetGraphView() {
  selectedNodeId.value = null
  if (svgRef.value && zoomBehavior) {
    select(svgRef.value).call(zoomBehavior.transform, zoomIdentity)
  }
}

async function renderGraph() {
  await nextTick()
  const element = svgRef.value
  if (!element || element.clientWidth === 0 || element.clientHeight === 0) {
    return
  }

  simulation?.stop()
  const svg = select(element)
  svg.selectAll('*').remove()
  const width = element.clientWidth
  const height = element.clientHeight
  svg.attr('viewBox', `0 0 ${width} ${height}`)

  const defs = svg.append('defs')
  for (const marker of [
    { id: 'chunk-graph-arrow-static', color: props.theme === 'dark' ? '#60a5fa' : '#2563eb' },
    { id: 'chunk-graph-arrow-dynamic', color: '#f59e0b' },
  ]) {
    defs.append('marker')
      .attr('id', marker.id)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 16)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', marker.color)
  }

  const viewport = svg.append('g')
  zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 5])
    .on('zoom', event => viewport.attr('transform', event.transform.toString()))
  svg.call(zoomBehavior)
  viewport.attr('transform', zoomTransform(element).toString())

  const nodes: RenderedGraphNode[] = visibleGraph.value.nodes.map((graphNode) => {
    const radius = graphNode.kind === 'package'
      ? 18
      : Math.max(5, Math.min(14, 5 + Math.log2(Math.max(graphNode.size, 1)) * 0.65))
    return {
      id: graphNode.id,
      graphNode,
      color: packageColorById.value.get(graphNode.packageId) ?? '#64748b',
      radius,
    }
  })
  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const links: RenderedGraphLink[] = visibleGraph.value.edges.map(graphEdge => ({
    graphEdge,
    source: graphEdge.source,
    target: graphEdge.target,
  }))

  const linkSelection = viewport.append('g')
    .attr('fill', 'none')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', link => link.graphEdge.kind === 'dynamic-import'
      ? '#f59e0b'
      : link.graphEdge.kind === 'static-import'
        ? props.theme === 'dark' ? '#60a5fa' : '#2563eb'
        : props.theme === 'dark' ? '#292f3a' : '#d9dee7')
    .attr('stroke-width', link => link.graphEdge.kind === 'contains' ? 1 : 1.4)
    .attr('stroke-opacity', link => link.graphEdge.kind === 'contains' ? 0.26 : 0.68)
    .attr('stroke-dasharray', link => link.graphEdge.kind === 'dynamic-import' ? '5 4' : null)
    .attr('marker-end', link => link.graphEdge.kind === 'dynamic-import'
      ? 'url(#chunk-graph-arrow-dynamic)'
      : link.graphEdge.kind === 'static-import'
        ? 'url(#chunk-graph-arrow-static)'
        : null)

  const nodeSelection = viewport.append('g')
    .selectAll<SVGGElement, RenderedGraphNode>('g')
    .data(nodes, node => node.id)
    .join('g')
    .attr('cursor', 'pointer')
    .on('click', (_event, node) => selectNode(node))
    .call(
      drag<SVGGElement, RenderedGraphNode>()
        .on('start', (event, node) => bindNodeDrag(event, node, 'start'))
        .on('drag', (event, node) => bindNodeDrag(event, node, 'update'))
        .on('end', (event, node) => bindNodeDrag(event, node, 'end')),
    )

  nodeSelection.append('circle')
    .attr('r', node => node.radius)
    .attr('fill', node => node.graphNode.kind === 'package' ? node.color : `${node.color}cc`)
    .attr('stroke', node => node.graphNode.kind === 'package' ? node.color : props.theme === 'dark' ? '#11141a' : '#ffffff')
    .attr('stroke-width', node => resolveNodeStrokeWidth(node))

  nodeSelection.append('title')
    .text(node => `${node.graphNode.label}\n${node.graphNode.packageLabel}\n${formatBytes(node.graphNode.size)}`)

  nodeSelection.filter(node => node.graphNode.kind === 'package')
    .append('text')
    .attr('x', 0)
    .attr('y', node => node.radius + 15)
    .attr('text-anchor', 'middle')
    .attr('font-size', 11)
    .attr('font-weight', 600)
    .attr('fill', props.theme === 'dark' ? '#d7dce5' : '#334155')
    .text(node => formatPackageLabel(node.graphNode.label))

  simulation = forceSimulation(nodes)
    .force('link', forceLink<RenderedGraphNode, RenderedGraphLink>(links)
      .id(node => node.id)
      .distance(link => link.graphEdge.kind === 'contains' ? 68 : link.graphEdge.kind === 'dynamic-import' ? 120 : 92)
      .strength(link => link.graphEdge.kind === 'contains' ? 0.2 : 0.5))
    .force('charge', forceManyBody().strength(nodes.length > 180 ? -78 : -120))
    .force('collision', forceCollide<RenderedGraphNode>()
      .radius(node => node.graphNode.kind === 'package' ? 52 : node.radius + 6)
      .strength(0.95))
    .force('center', forceCenter(width / 2, height / 2))
    .alphaDecay(0.035)
    .on('tick', () => {
      for (const node of nodes) {
        const padding = node.graphNode.kind === 'package' ? 58 : node.radius + 4
        node.x = Math.max(padding, Math.min(width - padding, node.x ?? width / 2))
        node.y = Math.max(padding, Math.min(height - padding, node.y ?? height / 2))
      }
      linkSelection
        .attr('x1', link => resolveLinkNode(link.source, nodeById)?.x ?? 0)
        .attr('y1', link => resolveLinkNode(link.source, nodeById)?.y ?? 0)
        .attr('x2', link => resolveLinkNode(link.target, nodeById)?.x ?? 0)
        .attr('y2', link => resolveLinkNode(link.target, nodeById)?.y ?? 0)
      nodeSelection.attr('transform', node => `translate(${node.x ?? 0},${node.y ?? 0})`)
    })
}

onMounted(() => {
  if (svgRef.value) {
    resizeObserver = new ResizeObserver(() => void renderGraph())
    resizeObserver.observe(svgRef.value)
  }
  void renderGraph()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  simulation?.stop()
  simulation = undefined
})

watch(packageOptions, (options) => {
  if (
    packageFilter.value !== 'all'
    && !options.some(option => option.packageId === packageFilter.value)
  ) {
    packageFilter.value = 'all'
  }
})
watch([visibleGraph, packageColorById], ([view]) => {
  if (selectedNodeId.value && !view.nodes.some(node => node.id === selectedNodeId.value)) {
    selectedNodeId.value = null
  }
  void renderGraph()
}, { deep: true })
watch(() => props.theme, () => void renderGraph())
</script>

<template>
  <section class="grid min-h-[calc(100dvh-9rem)] min-w-0 overflow-hidden rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) xl:grid-cols-[minmax(0,1fr)_18rem]">
    <div class="grid min-h-0 min-w-0 grid-rows-[auto_minmax(30rem,1fr)]">
      <header class="grid min-w-0 grid-cols-1 gap-2 border-b border-(--dashboard-border) px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_auto]">
        <label class="relative min-w-0">
          <span class="sr-only">搜索 chunk</span>
          <input
            v-model="searchQuery"
            class="h-8 w-full min-w-0 rounded border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-xs outline-none focus:border-(--dashboard-accent)"
            placeholder="搜索 chunk 文件"
            type="search"
          >
        </label>
        <AppSelect
          v-model="packageFilter"
          class="min-w-0"
          label="筛选依赖图 package"
          :options="packageFilterOptions"
          size="sm"
        />
        <div class="flex items-center gap-1" role="group" aria-label="依赖图视图控制">
          <button class="h-8 w-8 rounded border border-(--dashboard-border) text-sm hover:bg-(--dashboard-panel-muted) focus-visible:ring-2 focus-visible:ring-(--dashboard-accent)" type="button" aria-label="缩小依赖图" title="缩小（-）" @click="zoomGraph(0.8)">
            −
          </button>
          <button class="h-8 w-8 rounded border border-(--dashboard-border) text-sm hover:bg-(--dashboard-panel-muted) focus-visible:ring-2 focus-visible:ring-(--dashboard-accent)" type="button" aria-label="放大依赖图" title="放大（+）" @click="zoomGraph(1.25)">
            +
          </button>
          <button class="h-8 whitespace-nowrap rounded border border-(--dashboard-border) px-2 text-xs hover:bg-(--dashboard-panel-muted) focus-visible:ring-2 focus-visible:ring-(--dashboard-accent)" type="button" aria-label="适配依赖图视图" title="适配视图（0）" @click="resetGraphView">
            适配
          </button>
        </div>
      </header>
      <svg ref="svgRef" class="block h-full min-h-0 w-full min-w-0 max-w-full touch-none overflow-hidden" aria-hidden="true" focusable="false" />
    </div>

    <aside class="grid min-w-0 overflow-hidden border-t border-(--dashboard-border) bg-(--dashboard-panel-muted) sm:grid-cols-2 xl:block xl:border-t-0 xl:border-l">
      <div class="border-b border-(--dashboard-border) px-3 py-3">
        <p class="text-[10px] font-medium uppercase tracking-[0.12em] text-(--dashboard-text-soft)">Graph summary</p>
        <dl class="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div><dt class="text-(--dashboard-text-soft)">Nodes</dt><dd class="font-mono">{{ visibleGraph.nodes.length }}</dd></div>
          <div><dt class="text-(--dashboard-text-soft)">Edges</dt><dd class="font-mono">{{ visibleGraph.edges.length }}</dd></div>
          <div><dt class="text-(--dashboard-text-soft)">Static</dt><dd class="font-mono text-blue-500">{{ graph.staticImportCount }}</dd></div>
          <div><dt class="text-(--dashboard-text-soft)">Dynamic</dt><dd class="font-mono text-amber-500">{{ graph.dynamicImportCount }}</dd></div>
        </dl>
        <label class="mt-3 grid min-w-0 gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-(--dashboard-text-soft)">
          节点选择
          <select v-model="selectedNodeId" class="min-h-32 w-full min-w-0 rounded border border-(--dashboard-border) bg-(--dashboard-panel) p-1.5 text-xs normal-case tracking-normal text-(--dashboard-text)" size="6">
            <option v-for="node in visibleGraph.nodes" :key="node.id" :value="node.id">
              {{ node.label }} · {{ node.packageLabel }}
            </option>
          </select>
        </label>
        <div class="mt-3 grid grid-cols-3 gap-1" role="group" aria-label="依赖图平移控制">
          <span aria-hidden="true" />
          <button class="h-7 rounded border border-(--dashboard-border) text-xs hover:bg-(--dashboard-panel)" type="button" aria-label="向上平移依赖图" @click="panGraph(0, -40)">↑</button>
          <span aria-hidden="true" />
          <button class="h-7 rounded border border-(--dashboard-border) text-xs hover:bg-(--dashboard-panel)" type="button" aria-label="向左平移依赖图" @click="panGraph(-40, 0)">←</button>
          <button class="h-7 rounded border border-(--dashboard-border) text-xs hover:bg-(--dashboard-panel)" type="button" aria-label="向下平移依赖图" @click="panGraph(0, 40)">↓</button>
          <button class="h-7 rounded border border-(--dashboard-border) text-xs hover:bg-(--dashboard-panel)" type="button" aria-label="向右平移依赖图" @click="panGraph(40, 0)">→</button>
        </div>
      </div>

      <div v-if="selectedNode" class="min-w-0 border-l-0 border-(--dashboard-border) px-3 py-3 sm:border-l xl:border-l-0">
        <p class="text-[10px] font-medium uppercase tracking-[0.12em] text-(--dashboard-text-soft)">Selected</p>
        <h3 class="mt-2 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs font-semibold text-(--dashboard-text)" :title="selectedNode.label">
          {{ selectedNode.label }}
        </h3>
        <dl class="mt-3 grid min-w-0 gap-2 text-xs">
          <div class="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-2"><dt class="text-(--dashboard-text-soft)">Kind</dt><dd class="min-w-0 truncate text-right">{{ selectedNode.kind }}</dd></div>
          <div class="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-2"><dt class="text-(--dashboard-text-soft)">Package</dt><dd class="min-w-0 truncate text-right" :title="selectedNode.packageLabel">{{ selectedNode.packageLabel }}</dd></div>
          <div class="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-2"><dt class="text-(--dashboard-text-soft)">Size</dt><dd class="min-w-0 truncate text-right font-mono">{{ formatBytes(selectedNode.size) }}</dd></div>
          <div v-if="selectedNode.moduleCount !== undefined" class="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-2"><dt class="text-(--dashboard-text-soft)">Modules</dt><dd class="min-w-0 truncate text-right font-mono">{{ selectedNode.moduleCount }}</dd></div>
          <div v-if="selectedNode.fileCount !== undefined" class="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-2"><dt class="text-(--dashboard-text-soft)">Files</dt><dd class="min-w-0 truncate text-right font-mono">{{ selectedNode.fileCount }}</dd></div>
        </dl>
        <div class="mt-3 min-w-0">
          <h4 class="text-[10px] font-medium uppercase tracking-[0.12em] text-(--dashboard-text-soft)">
            Import edges
          </h4>
          <p v-if="!selectedImportEdges.length" class="mt-1 text-xs text-(--dashboard-text-soft)">
            当前节点没有可见的静态或动态 import。
          </p>
          <ul v-else class="mt-1 grid max-h-32 gap-1 overflow-y-auto text-xs">
            <li v-for="edge in selectedImportEdges" :key="edge.id" class="min-w-0">
              <span class="font-medium">{{ edge.relation }} · {{ edge.kind }}</span>
              <span class="ml-1 break-all text-(--dashboard-text-soft)">{{ edge.label }}</span>
            </li>
          </ul>
        </div>
      </div>
      <div v-else class="min-w-0 border-l-0 border-(--dashboard-border) px-3 py-5 text-xs leading-5 text-(--dashboard-text-soft) sm:border-l xl:border-l-0">
        使用节点选择器查看 package、体积和模块数；图中仍可滚轮缩放与拖动画布。蓝色实线是静态 import，橙色虚线是动态 import。
      </div>

      <div v-if="graph.unresolvedImportCount" class="border-t border-(--dashboard-border) px-3 py-3 text-[11px] text-amber-500 sm:col-span-2 xl:col-auto">
        {{ graph.unresolvedImportCount }} 条 import 指向未输出或外部 chunk。
      </div>
      <div v-if="visibleGraph.truncatedNodeCount || visibleGraph.truncatedEdgeCount" class="border-t border-(--dashboard-border) px-3 py-3 text-[11px] text-(--dashboard-text-soft) sm:col-span-2 xl:col-auto">
        为保持交互流畅，当前隐藏 {{ visibleGraph.truncatedNodeCount }} 个节点与 {{ visibleGraph.truncatedEdgeCount }} 条边。
      </div>
    </aside>
  </section>
</template>
