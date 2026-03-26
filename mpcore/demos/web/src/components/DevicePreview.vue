<script setup lang="ts">
import SectionCard from './SectionCard.vue'

defineProps<{
  markup: string
  route: string
}>()

const emit = defineEmits<{
  back: []
  callMethod: [method: string]
  callScopeMethod: [payload: { method: string, scopeId: string }]
  selectScope: [scopeId: string]
}>()

function resolveTapBinding(target: EventTarget | null) {
  let current = target instanceof HTMLElement ? target : null

  while (current) {
    const scopeId = current.getAttribute('data-sim-scope') ?? ''
    const bindTap = current.getAttribute('bindtap') || current.getAttribute('bind:tap')
    if (bindTap) {
      return {
        method: bindTap,
        scopeId,
      }
    }
    if (scopeId) {
      return {
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
  emit('callMethod', binding.method)
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
