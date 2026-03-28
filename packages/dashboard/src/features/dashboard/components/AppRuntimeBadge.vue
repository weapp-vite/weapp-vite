<script setup lang="ts">
import type { VariantProps } from 'tailwind-variants'
import { runtimeBadgeStyles } from '../utils/styles'

type RuntimeBadgeTone = NonNullable<VariantProps<typeof runtimeBadgeStyles>['tone']>

const props = withDefaults(defineProps<{
  label: string
  tone?: RuntimeBadgeTone
}>(), {
  tone: 'neutral',
})
</script>

<template>
  <span :class="runtimeBadgeStyles({ tone: props.tone })">
    {{ label }}
  </span>
</template>
