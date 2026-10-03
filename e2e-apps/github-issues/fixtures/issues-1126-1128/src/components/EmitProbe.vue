<script setup lang="ts">
const emit = defineEmits<{ click: [payload: { marker: string }], confirmed: [payload: { marker: string }] }>()
function activate() {
  emit('click', { marker: 'component-click' })
  emit('confirmed', { marker: 'component-confirmed' })
}
defineComponentJson({ component: true })
</script>

<template>
  <button id="emit-click" @tap="activate">Emit one click</button>
</template>
