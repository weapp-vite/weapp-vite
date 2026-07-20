<script setup lang="ts">
const props = defineProps<{
  count: number
  label: string
}>()
const emit = defineEmits<{
  increment: [value: number]
}>()

function increment() {
  emit('increment', props.count + 1)
}
</script>

<template>
  <div class="counter-card">
    <text id="component-label">{{ label }}={{ count }}</text>
    <text id="component-increment" class="action" @click="increment">child increment</text>
  </div>
</template>

<style>
.counter-card {
  flex-direction: column;
}
</style>
