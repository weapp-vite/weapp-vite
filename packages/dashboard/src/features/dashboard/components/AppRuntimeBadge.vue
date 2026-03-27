<script setup lang="ts">
import type { VariantProps } from 'tailwind-variants'
import { computed } from 'vue'
import { runtimeBadgeStyles } from '../utils/styles'

type RuntimeBadgeTone = NonNullable<VariantProps<typeof runtimeBadgeStyles>['tone']>

const props = withDefaults(defineProps<{
  label: string
  tone?: RuntimeBadgeTone
}>(), {
  tone: 'neutral',
})

const badgeClassName = computed(() => runtimeBadgeStyles({ tone: props.tone }))
</script>

<template>
  <span :class="badgeClassName">
    {{ label }}
  </span>
</template>
