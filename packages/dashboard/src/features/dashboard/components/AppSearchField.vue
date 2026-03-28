<script setup lang="ts">
import AppMetaLabel from './AppMetaLabel.vue'

defineProps<{
  inputId: string
  modelValue: string
  label: string
  placeholder: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div>
    <label :for="inputId">
      <AppMetaLabel>
        {{ label }}
      </AppMetaLabel>
    </label>
    <input
      :id="inputId"
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      class="mt-2 w-full rounded-2xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel)] px-3 py-2 text-sm text-[color:var(--dashboard-text)] outline-none transition focus:border-[color:var(--dashboard-border-strong)]"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </div>
</template>
