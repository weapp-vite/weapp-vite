<script setup lang="ts">
import type {
  D3DragEvent,
  SimulationLinkDatum,
  SimulationNodeDatum,
  ZoomBehavior,
} from 'd3'
import type { AnalyzeSubpackagesResult, ResolvedTheme } from '../types'
import type { AnalyzeChunkGraphEdge, AnalyzeChunkGraphNode } from '../utils/analyzeChunkGraph'
import type { ChunkGraphLinkGeometry } from '../utils/chunkGraphGeometry'
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
import { CHUNK_GRAPH_ARROW_SIZE, updateChunkGraphLinkGeometry } from '../utils/chunkGraphGeometry'
import { formatBytes } from '../utils/format'
import AppSelect from './AppSelect.vue'
import ChunkGraphInspector from './chunkGraph/Inspector.vue'

interface RenderedGraphNode extends SimulationNodeDatum {
  color: string
  graphNode: AnalyzeChunkGraphNode
  id: string
  radius: number
  strokeWidth: number
}

interface RenderedGraphLink extends SimulationLinkDatum<RenderedGraphNode>, ChunkGraphLinkGeometry {
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
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('markerUnits', 'userSpaceOnUse')
      .attr('markerWidth', CHUNK_GRAPH_ARROW_SIZE)
      .attr('markerHeight', CHUNK_GRAPH_ARROW_SIZE)
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
      strokeWidth: graphNode.kind === 'package' ? 3 : graphNode.isEntry ? 2.5 : 1.5,
    }
  })
  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const links: RenderedGraphLink[] = visibleGraph.value.edges.map(graphEdge => ({
    graphEdge,
    source: graphEdge.source,
    target: graphEdge.target,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
    visible: false,
  }))

  const linkSelection = viewport.append('g')
    .attr('fill', 'none')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('visibility', 'hidden')
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
    .attr('fill', node => node.color)
    .attr('stroke', node => node.graphNode.kind === 'package' ? node.color : props.theme === 'dark' ? '#11141a' : '#ffffff')
    .attr('stroke-width', node => node.strokeWidth)

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
        .each((link) => {
          const source = resolveLinkNode(link.source, nodeById)
          const target = resolveLinkNode(link.target, nodeById)
          link.visible = false
          if (source && target) {
            updateChunkGraphLinkGeometry(link, source, target, link.graphEdge.kind !== 'contains')
          }
        })
        .attr('visibility', link => link.visible ? null : 'hidden')
        .attr('x1', link => link.x1)
        .attr('y1', link => link.y1)
        .attr('x2', link => link.x2)
        .attr('y2', link => link.y2)
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
  <section class="grid min-h-0 min-w-0 overflow-hidden rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) xl:h-[calc(100dvh-10rem)] xl:min-h-[36rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div class="grid min-h-0 min-w-0 grid-rows-[auto_minmax(30rem,1fr)_auto]">
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
      <footer class="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-(--dashboard-border) px-3 py-2">
        <p class="text-xs text-(--dashboard-text-soft)">
          滚轮缩放，拖动画布平移；也可使用视图控制按钮。
        </p>
        <div class="flex gap-1" role="group" aria-label="依赖图平移控制">
          <button class="size-8 rounded border border-(--dashboard-border) text-sm hover:bg-(--dashboard-panel-muted) focus-visible:outline-2 focus-visible:outline-(--dashboard-accent) pointer-coarse:size-11" type="button" aria-label="向上平移依赖图" @click="panGraph(0, -40)">↑</button>
          <button class="size-8 rounded border border-(--dashboard-border) text-sm hover:bg-(--dashboard-panel-muted) focus-visible:outline-2 focus-visible:outline-(--dashboard-accent) pointer-coarse:size-11" type="button" aria-label="向左平移依赖图" @click="panGraph(-40, 0)">←</button>
          <button class="size-8 rounded border border-(--dashboard-border) text-sm hover:bg-(--dashboard-panel-muted) focus-visible:outline-2 focus-visible:outline-(--dashboard-accent) pointer-coarse:size-11" type="button" aria-label="向下平移依赖图" @click="panGraph(0, 40)">↓</button>
          <button class="size-8 rounded border border-(--dashboard-border) text-sm hover:bg-(--dashboard-panel-muted) focus-visible:outline-2 focus-visible:outline-(--dashboard-accent) pointer-coarse:size-11" type="button" aria-label="向右平移依赖图" @click="panGraph(40, 0)">→</button>
        </div>
      </footer>
    </div>

    <ChunkGraphInspector
      :view="visibleGraph"
      :selected-id="selectedNodeId"
      :unresolved-import-count="graph.unresolvedImportCount"
      @select-node="selectedNodeId = $event"
    />
  </section>
</template>
