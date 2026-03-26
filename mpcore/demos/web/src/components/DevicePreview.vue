<script setup lang="ts">
import SectionCard from './SectionCard.vue'

defineProps<{
  markup: string
  route: string
}>()

const emit = defineEmits<{
  back: []
  callMethod: [payload: { event: { dataset: Record<string, string>, id: string }, method: string }]
  callScopeMethod: [payload: {
    event: {
      currentTarget: { dataset: Record<string, string>, id: string }
      target: { dataset: Record<string, string>, id: string }
    }
    method: string
    scopeId: string
  }]
  selectScope: [scopeId: string]
}>()

function collectDataset(node: HTMLElement) {
  const dataset: Record<string, string> = {}
  for (const [key, value] of Object.entries(node.dataset)) {
    dataset[key] = String(value)
  }
  return dataset
}

function resolveTapBinding(target: EventTarget | null) {
  const origin = target instanceof HTMLElement ? target : null
  let current = origin

  while (current) {
    const scopeId = current.getAttribute('data-sim-scope') ?? ''
    const bindTap = current.getAttribute('bindtap') || current.getAttribute('bind:tap')
    if (bindTap) {
      return {
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
        method: bindTap,
        scopeId,
      }
    }
    if (scopeId) {
      return {
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
        method: '',
        scopeId,
      }
    }
    current = current.parentElement
  }

  return null
}

function handleScreenClick(event: MouseEvent) {
  const binding = resolveTapBinding(event.target)
  if (!binding?.scopeId) {
    return
  }
  emit('selectScope', binding.scopeId)
  if (!binding.method) {
    return
  }
  if (binding.scopeId) {
    emit('callScopeMethod', binding)
    return
  }
  emit('callMethod', {
    event: binding.event.target,
    method: binding.method,
  })
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
      <div class="sim-device__screen" v-html="markup" @click="handleScreenClick" />
    </div>
  </SectionCard>
</template>
