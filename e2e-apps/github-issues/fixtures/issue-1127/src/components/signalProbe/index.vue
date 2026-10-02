<script setup lang="ts">
const emit = defineEmits<{
  signal: [detail: { value: number }, options?: { bubbles?: boolean, composed?: boolean, capturePhase?: boolean }]
}>()
function privateSignal() {
  emit('signal', { value: 11 })
}
function captureSignal() {
  emit('signal', { value: 19 }, { capturePhase: true })
}
function localSignal() {
  emit('signal', { value: 23 }, { bubbles: true, composed: false, capturePhase: true })
}
function publicSignal() {
  emit('signal', { value: 37 }, { bubbles: true, composed: true, capturePhase: true })
}
defineComponentJson({ component: true })
</script>

<template>
  <button id="emit-private" @tap="privateSignal">Private signal</button>
  <button id="emit-capture" @tap="captureSignal">Capture without bubbling</button>
  <button id="emit-local" @tap="localSignal">Local bubbling signal</button>
  <button id="emit-public" @tap="publicSignal">Composed bubbling signal</button>
</template>
