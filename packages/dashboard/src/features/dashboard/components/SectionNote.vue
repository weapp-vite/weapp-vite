<script setup lang="ts">
import { sectionNoteStyles } from '../utils/styles'

defineProps<{
  text: string
}>()
</script>

<template>
  <div :class="sectionNoteStyles()">
    {{ text }}
  </div>
</template>
