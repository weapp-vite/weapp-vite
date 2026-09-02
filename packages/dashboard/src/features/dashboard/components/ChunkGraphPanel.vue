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
} from 'd3'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { createAnalyzeChunkGraph } from '../utils/analyzeChunkGraph'
import { formatBytes } from '../utils/format'

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

const MAX_VISIBLE_CHUNKS = 220
const svgRef = shallowRef<SVGSVGElement>()
const packageFilter = ref('all')
const searchQuery = ref('')
const selectedNodeId = ref<string | null>(null)
let resizeObserver: ResizeObserver | undefined
let simulation: ReturnType<typeof forceSimulation<RenderedGraphNode>> | undefined
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | undefined

const graph = computed(() => createAnalyzeChunkGraph(props.result))
const packageOptions = computed(() => graph.value.nodes.filter(node => node.kind === 'package'))
const selectedNode = computed(() => graph.value.nodes.find(node => node.id === selectedNodeId.value) ?? null)
const visibleGraph = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const packageNodes = graph.value.nodes.filter(node => node.kind === 'package')
  let chunkNodes = graph.value.nodes.filter(node => node.kind === 'chunk')
  if (packageFilter.value !== 'all') {
    chunkNodes = chunkNodes.filter(node => node.packageId === packageFilter.value)
  }
  if (query) {
    chunkNodes = chunkNodes.filter(node => node.label.toLowerCase().includes(query))
  }
  chunkNodes = chunkNodes
    .sort((left, right) => right.size - left.size)
    .slice(0, MAX_VISIBLE_CHUNKS)

  const visibleIds = new Set(chunkNodes.map(node => node.id))
  const relatedEdges = graph.value.edges.filter(edge =>
    edge.kind !== 'contains' && (visibleIds.has(edge.source) || visibleIds.has(edge.target)),
  )
  for (const edge of relatedEdges) {
    visibleIds.add(edge.source)
    visibleIds.add(edge.target)
  }

  const relatedChunks = graph.value.nodes.filter(node => node.kind === 'chunk' && visibleIds.has(node.id))
  const visiblePackageIds = new Set(relatedChunks.map(node => node.packageId))
  const relatedPackages = packageNodes.filter(node => visiblePackageIds.has(node.packageId))
  const nodes = [...relatedPackages, ...relatedChunks]
  const nodeIds = new Set(nodes.map(node => node.id))
  const edges = graph.value.edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
  return { edges, nodes }
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
    .attr('role', 'button')
    .attr('tabindex', 0)
    .on('click', (_event, node) => selectNode(node))
    .on('keydown', (event, node) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        selectNode(node)
      }
    })
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
    .attr('stroke-width', node => node.graphNode.kind === 'package' ? 3 : node.graphNode.isEntry ? 2.5 : 1.5)

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

function resetGraphView() {
  selectedNodeId.value = null
  if (svgRef.value && zoomBehavior) {
    select(svgRef.value).call(zoomBehavior.transform, zoomIdentity)
  }
  void renderGraph()
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

watch([visibleGraph, packageColorById], () => void renderGraph(), { deep: true })
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
        <select v-model="packageFilter" class="h-8 w-full min-w-0 truncate rounded border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2 text-xs">
          <option value="all">全部 package</option>
          <option v-for="item in packageOptions" :key="item.id" :value="item.packageId">
            {{ item.packageLabel }}
          </option>
        </select>
        <button class="h-8 whitespace-nowrap rounded border border-(--dashboard-border) px-2.5 text-xs hover:bg-(--dashboard-panel-muted)" type="button" @click="resetGraphView">
          重置视图
        </button>
      </header>
      <svg ref="svgRef" class="block h-full min-h-0 w-full min-w-0 max-w-full touch-none overflow-hidden" aria-label="Chunk dependency graph" role="img" />
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
      </div>
      <div v-else class="min-w-0 border-l-0 border-(--dashboard-border) px-3 py-5 text-xs leading-5 text-(--dashboard-text-soft) sm:border-l xl:border-l-0">
        点击节点查看 package、体积和模块数。滚轮缩放，拖动画布平移；蓝色实线是静态 import，橙色虚线是动态 import。
      </div>

      <div v-if="graph.unresolvedImportCount" class="border-t border-(--dashboard-border) px-3 py-3 text-[11px] text-amber-500 sm:col-span-2 xl:col-auto">
        {{ graph.unresolvedImportCount }} 条 import 指向未输出或外部 chunk。
      </div>
    </aside>
  </section>
</template>
