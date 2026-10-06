<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'

const props = defineProps<{ edges: Array<{ from: string, to: string, active: boolean }> }>()
const svg = useTemplateRef<SVGSVGElement>('svg')
const paths = shallowRef<Array<{ d: string, active: boolean }>>([])
let observer: ResizeObserver | undefined
let disposed = false

/** 连线端点取真实卡片边界，不把分页外或不存在的落点画成关系。 */
async function updatePaths() {
  await nextTick()
  if (disposed || !svg.value?.parentElement) {
    return
  }
  const parent = svg.value.parentElement
  const bounds = parent.getBoundingClientRect()
  const nodes = new Map<string, DOMRect>()
  for (const element of parent.querySelectorAll<HTMLElement>('[data-node-key]')) {
    if (element.dataset.nodeKey) {
      nodes.set(element.dataset.nodeKey, element.getBoundingClientRect())
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

watch(() => props.edges, updatePaths, { flush: 'post' })
onMounted(() => {
  if (svg.value?.parentElement) {
    observer = new ResizeObserver(updatePaths)
    observer.observe(svg.value.parentElement)
  }
  void updatePaths()
})
onBeforeUnmount(() => {
  disposed = true
  observer?.disconnect()
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
