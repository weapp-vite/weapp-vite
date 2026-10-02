<script setup lang="ts">
const emit = defineEmits<{
  click: []
  payload: [detail: { message: string, count: number }]
  input: [detail: { value: string, source: string }]
}>()
function activate() {
  emit('click')
}
function sendPayload() {
  emit('payload', { message: 'kept-detail', count: 7 })
}
function input(event: { detail: { value: string } }) {
  emit('input', { value: event.detail.value, source: 'component' })
}
defineComponentJson({ component: true })
</script>

<template>
  <button id="emit-click" @tap="activate">Emit one click</button>
  <button id="emit-payload" @tap="sendPayload">Emit detail</button>
  <button id="native-only">Native gesture only</button>
  <textarea id="nested-input" @input="input" />
</template>
