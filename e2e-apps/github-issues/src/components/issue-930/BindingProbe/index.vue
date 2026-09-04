<script setup lang="ts">
defineProps<{
  modelValue: string
  modelModifiers?: Record<string, boolean>
}>()
</script>

<template>
  <view
    id="issue-930-model-probe"
    :data-model-value="modelValue"
    :data-trim="modelModifiers?.trim ? 'true' : 'false'"
  >
    {{ modelValue }}
  </view>
</template>
