<script setup lang="ts">
import { sectionNoteStyles } from '../utils/styles'

defineProps<{
  text: string
}>()

const noteClassName = sectionNoteStyles()
</script>

<template>
  <div :class="noteClassName">
    {{ text }}
  </div>
</template>
