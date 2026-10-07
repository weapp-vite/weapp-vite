<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'

const props = defineProps<{ edges: Array<{ from: string, to: string, active: boolean }> }>()
const svg = useTemplateRef<SVGSVGElement>('svg')
const paths = shallowRef<Array<{ d: string, active: boolean }>>([])
let observer: ResizeObserver | undefined
let parent: HTMLElement | undefined
let frame: number | undefined
let disposed = false

/** 连线只连接滚动视口内的真实对象，不把隐藏行画成关系。 */
async function updatePaths() {
  await nextTick()
  if (disposed || !svg.value?.parentElement) {
    return
  }
  const container = svg.value.parentElement
  if (!svg.value.getClientRects().length) {
    paths.value = []
    return
  }
  const bounds = container.getBoundingClientRect()
  const nodes = new Map<string, DOMRect>()
  for (const list of container.querySelectorAll<HTMLElement>('.lane-nodes')) {
    const viewport = list.getBoundingClientRect()
    for (const element of list.querySelectorAll<HTMLElement>('[data-node-key]')) {
      const rect = element.getBoundingClientRect()
      const center = rect.top + rect.height / 2
      if (element.dataset.nodeKey && center >= viewport.top && center <= viewport.bottom) {
        nodes.set(element.dataset.nodeKey, rect)
      }
    }
  }
  paths.value = props.edges.flatMap((edge) => {
    const from = nodes.get(edge.from)
    const to = nodes.get(edge.to)
    if (!from || !to || to.left <= from.right) {
      return []
    }
    const x1 = from.right - bounds.left
    const x2 = to.left - bounds.left
    const y1 = from.top + from.height / 2 - bounds.top
    const y2 = to.top + to.height / 2 - bounds.top
    const middle = (x1 + x2) / 2
    return [{ d: `M ${x1} ${y1} H ${middle} V ${y2} H ${x2}`, active: edge.active }]
  })
}

function scheduleUpdate() {
  if (frame === undefined) {
    frame = requestAnimationFrame(() => {
      frame = undefined
      void updatePaths()
    })
  }
}

watch(() => props.edges, scheduleUpdate, { flush: 'post' })
onMounted(() => {
  parent = svg.value?.parentElement ?? undefined
  if (parent) {
    observer = new ResizeObserver(scheduleUpdate)
    observer.observe(parent)
    parent.addEventListener('scroll', scheduleUpdate, { capture: true, passive: true })
  }
  scheduleUpdate()
})
onBeforeUnmount(() => {
  disposed = true
  observer?.disconnect()
  parent?.removeEventListener('scroll', scheduleUpdate, true)
  if (frame !== undefined) {
    cancelAnimationFrame(frame)
  }
})
</script>

<template>
  <svg ref="svg" class="relation-wires" aria-hidden="true">
    <path v-for="(path, index) in paths" :key="index" :d="path.d" :class="{ active: path.active }" />
  </svg>
</template>

<style scoped>
.relation-wires {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.relation-wires path {
  fill: none;
  stroke: var(--dashboard-border-strong);
  stroke-width: 1.3;
  vector-effect: non-scaling-stroke;
  transition: stroke 120ms, stroke-width 120ms;
}

.relation-wires path.active {
  stroke: var(--dashboard-accent);
  stroke-width: 1.8;
}

@keyframes relation-flow {
  to {
    stroke-dashoffset: -24px;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .relation-wires path.active {
    stroke-linecap: round;
    stroke-dasharray: 6 6;
    animation: relation-flow 1.2s linear infinite;
  }
}

@media (max-width: 760px) {
  .relation-wires {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .relation-wires path {
    transition: none;
  }
}
</style>
