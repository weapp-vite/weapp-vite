<script setup lang="ts">
import { mutedPanelStyles } from '../utils/styles'

defineProps<{
  eyebrow?: string
}>()
</script>

<template>
  <div :class="mutedPanelStyles()">
    <p
      v-if="eyebrow"
      class="text-[11px] uppercase tracking-[0.18em] text-(--dashboard-text-soft)"
    >
      {{ eyebrow }}
    </p>
    <div :class="eyebrow ? 'mt-3' : undefined">
      <slot />
    </div>
  </div>
</template>
