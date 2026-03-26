<script setup lang="ts">
import SectionCard from './SectionCard.vue'

defineProps<{
  markup: string
  route: string
}>()

const emit = defineEmits<{
  back: []
  dispatchTapChain: [payload: { activeScopeId: string, chain: PreviewTapInvocation[] }]
  selectScope: [scopeId: string]
}>()

interface PreviewTapEvent {
  currentTarget: { dataset: Record<string, string>, id: string }
  target: { dataset: Record<string, string>, id: string }
}

interface PreviewTapInvocation {
  event: PreviewTapEvent
  method: string
  scopeId: string
  stopAfter: boolean
}

function collectDataset(node: HTMLElement) {
  const dataset: Record<string, string> = {}
  for (const [key, value] of Object.entries(node.dataset)) {
    dataset[key] = String(value)
  }
  return dataset
}

function resolveTapChain(target: EventTarget | null) {
  const originNode = target instanceof Node ? target : null
  const origin = originNode instanceof HTMLElement
    ? originNode
    : originNode?.parentElement ?? null
  let current = origin
  let nearestScopeId = ''
  const chain: PreviewTapInvocation[] = []

  while (current) {
    const scopeId = current.getAttribute('data-sim-scope') ?? ''
    const catchTap = current.getAttribute('catchtap') || current.getAttribute('catch:tap')
    const bindTap = current.getAttribute('bindtap') || current.getAttribute('bind:tap')

    if (!nearestScopeId && scopeId) {
      nearestScopeId = scopeId
    }

    const method = catchTap || bindTap
    if (method && scopeId) {
      chain.push({
        event: {
          currentTarget: {
            dataset: collectDataset(current),
            id: current.id ?? '',
          },
          target: {
            dataset: origin ? collectDataset(origin) : {},
            id: origin?.id ?? '',
          },
        },
        method,
        scopeId,
        stopAfter: Boolean(catchTap),
      })
      if (catchTap) {
        break
      }
    }
    current = current.parentElement
  }

  if (!nearestScopeId) {
    return null
  }

  return {
    activeScopeId: nearestScopeId,
    chain,
  }
}

function handleScreenClick(event: MouseEvent) {
  const payload = resolveTapChain(event.target)
  if (!payload?.activeScopeId) {
    return
  }
  emit('selectScope', payload.activeScopeId)
  if (payload.chain.length === 0) {
    return
  }
  emit('dispatchTapChain', payload)
}
</script>

<template>
  <SectionCard title="🕛 模拟器" subtitle="左侧固定预览区，始终显示当前页面。">
    <div class="sim-device">
      <div class="sim-device__bar">
        <span>{{ route }}</span>
        <button class="sim-mini-btn" @click="emit('back')">
          返回
        </button>
      </div>
      <div class="sim-device__screen" @click="handleScreenClick" v-html="markup" />
    </div>
  </SectionCard>
</template>
