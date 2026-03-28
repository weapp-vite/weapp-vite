<script setup lang="ts">
import { computed } from 'vue'
import { mutedPanelStyles } from '../utils/styles'

const props = defineProps<{
  eyebrow?: string
}>()

const contentClassName = computed(() => props.eyebrow ? 'mt-3' : undefined)
</script>

<template>
  <div :class="mutedPanelStyles()">
    <p
      v-if="eyebrow"
      class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--dashboard-text-soft)]"
    >
      {{ eyebrow }}
    </p>
    <div :class="contentClassName">
      <slot />
    </div>
  </div>
</template>
